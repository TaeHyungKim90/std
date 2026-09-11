"""One persistent inference process. Kill and restart it on timeout; no queued overload."""
import multiprocessing
import threading


def _run(connection):
    from engine import make_engine, recognize, decode_image
    pipeline = None
    while True:
        try:
            data, mime = connection.recv()
        except EOFError:
            return
        try:
            decode_image(data, mime)  # Reject malformed input before model initialization.
            if pipeline is None:
                pipeline = make_engine()
            connection.send({'result': recognize(pipeline, data, mime)})
        except ValueError:
            connection.send({'error': 'invalid_image_or_no_fields'})
        except Exception:
            connection.send({'error': 'inference_failed'})


class BusyError(Exception): pass


class Worker:
    def __init__(self, timeout: float = 60):
        self.timeout = timeout
        self.lock = threading.Lock()
        self.process = self.connection = None

    def close(self):
        if self.process:
            if self.process.is_alive():
                self.process.terminate()
            self.process.join(timeout=3)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(timeout=3)
            self.process.close()
        if self.connection:
            self.connection.close()
        self.process = self.connection = None

    def infer(self, data, mime):
        if not self.lock.acquire(blocking=False):
            raise BusyError()
        try:
            if self.process is None or not self.process.is_alive():
                self.close()
                context = multiprocessing.get_context('spawn')
                self.connection, child = context.Pipe()
                self.process = context.Process(target=_run, args=(child,), daemon=True)
                self.process.start()
                child.close()
            connection = self.connection
            assert connection is not None
            connection.send((data, mime))
            if not connection.poll(self.timeout):
                self.close()
                raise TimeoutError('OCR deadline exceeded')
            return connection.recv()
        except TimeoutError:
            raise
        except (EOFError, BrokenPipeError, OSError):
            self.close()
            raise RuntimeError('OCR worker stopped')
        finally:
            self.lock.release()
