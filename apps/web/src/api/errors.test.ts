import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiError,
  ApiUnauthorizedError,
  extractErrorInfo,
  isSessionGoneError,
  localizeErrorMessage,
} from './errors.ts';

test('영문 서버 메시지를 한국어로 매핑한다', () => {
  assert.equal(localizeErrorMessage('Room not found', 404), '존재하지 않는 방이에요');
  assert.equal(localizeErrorMessage('Room is full', 409), '방이 가득 찼어요 (최대 6명)');
  assert.equal(localizeErrorMessage('interest text must be 20 characters or fewer'), '관심사는 12자 이내로 입력해주세요');
});

test('매핑이 없는 영문 메시지는 그대로 노출하지 않는다', () => {
  assert.equal(localizeErrorMessage('Something weird', 400), '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.');
  assert.equal(localizeErrorMessage(undefined, 500), '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.');
});

test('{ error: { code, message } } 와 { message } 둘 다 읽는다', () => {
  assert.deepEqual(extractErrorInfo({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
    code: 'NOT_FOUND',
    message: 'Not found',
  });
  assert.deepEqual(extractErrorInfo({ ok: false, message: 'Room not found' }), {
    code: undefined,
    message: 'Room not found',
  });
  assert.deepEqual(extractErrorInfo(null), {});
});

test('404/401/403 은 "세션이 사라진" 에러로 취급한다', () => {
  assert.equal(isSessionGoneError(new ApiError('x', 404)), true);
  assert.equal(isSessionGoneError(new ApiError('x', 403)), true);
  assert.equal(isSessionGoneError(new ApiUnauthorizedError('x')), true);
  assert.equal(isSessionGoneError(new ApiError('x', 500)), false);
  assert.equal(isSessionGoneError(new Error('x')), false);
});
