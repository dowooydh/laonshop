export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

/**
 * 복사·자동완성 과정에서 비밀번호 양끝에 붙은 공백 문자를 진단하기 위한 후보값.
 * 로그인 비밀번호를 자동 보정하거나 저장값을 바꾸지는 않고, 정확한 오류 안내에만 사용한다.
 */
export function getBoundaryWhitespaceTrimCandidate(value: string): string | null {
  const trimmed = value.replace(/^[\s\u200B]+|[\s\u200B]+$/gu, "");
  return trimmed && trimmed !== value ? trimmed : null;
}
