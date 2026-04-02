// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router v7 가 Jest(jsdom) 환경에서 기대하는 전역 (Node 20+ util)
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
