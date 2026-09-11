"""Pinned official model artifacts. Runtime only reads preinstalled, verified files."""
import hashlib
import json
import os
from pathlib import Path

MODEL_ROOT = Path(os.environ.get("OCR_MODEL_DIR", str(Path(__file__).parent / "models")))
ARTIFACTS = {
    "PP-OCRv5_mobile_det": "50446e5d01ac2a73d5319c89513281f6578414c888c602f9af13f93feefffc58",
    "korean_PP-OCRv5_mobile_rec": "a6261f800ad335aa6ef77b6f7c4dcedfd5e11b95f4d70982d41ee31c2ace5e66",
}


def verify_models():
    manifest = json.loads((MODEL_ROOT / "manifest.json").read_text())
    if manifest['artifacts'] != ARTIFACTS:
        raise ValueError("Unexpected model artifacts")
    actual = {p.relative_to(MODEL_ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in MODEL_ROOT.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    if actual != manifest['files']:
        raise ValueError("Model integrity verification failed")
    for name in ARTIFACTS:
        if not (MODEL_ROOT / name / 'inference.yml').is_file():
            raise ValueError("Missing OCR model")


if __name__ == '__main__':
    import argparse
    import io
    import tarfile
    import urllib.request
    parser = argparse.ArgumentParser()
    parser.add_argument('--archives', type=Path, help='Optional directory of predownloaded official tar archives')
    args = parser.parse_args()
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    for name, digest in ARTIFACTS.items():
        if args.archives:
            data = (args.archives / f'{name}.tar').read_bytes()
        else:
            url = f'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/{name}_infer.tar'
            with urllib.request.urlopen(url, timeout=90) as response:
                data = response.read(64 * 1024 * 1024 + 1)
        if len(data) > 64 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != digest:
            raise ValueError(f'Archive checksum mismatch: {name}')
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            # Only regular files/directories under the known model root.
            for member in archive.getmembers():
                if not (member.isfile() or member.isdir()) or '..' in Path(member.name).parts:
                    raise ValueError('Unexpected model archive entry')
                if Path(member.name).parts[0] != name + '_infer':
                    raise ValueError('Unexpected model directory')
            destination = MODEL_ROOT / name
            destination.mkdir(exist_ok=True)
            for filename in ('inference.yml', 'inference.json', 'inference.pdiparams'):
                source = archive.extractfile(f'{name}_infer/{filename}')
                if source is None:
                    raise ValueError('Missing model file')
                (destination / filename).write_bytes(source.read())
    files = {p.relative_to(MODEL_ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in MODEL_ROOT.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    (MODEL_ROOT / 'manifest.json').write_text(json.dumps({'artifacts': ARTIFACTS, 'files': files}, indent=2))
    verify_models()
    print('Official OCR models verified and installed.')
