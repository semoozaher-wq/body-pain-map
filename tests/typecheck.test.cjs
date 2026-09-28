'use strict';

// حرس انحدار لفئة الخطأ TS6133 (imports/متغيرات غير مستخدمة).
// قبل الإصلاح كان `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
// يُبلّغ عن 50 خطأً (معظمها `import React` ميت مع JSX runtime التلقائي).
// هذان الاختباران يمنعان رجوع أيٍّ منها لاحقًا.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

function runTsc(extraArgs) {
  try {
    return execFileSync('npx', ['tsc', '--noEmit', ...extraArgs], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    return `${error.stdout || ''}${error.stderr || ''}`;
  }
}

test('npx tsc --noEmit نظيف تمامًا', () => {
  const output = runTsc([]);
  const errors = output.split('\n').filter((line) => /error TS\d+/.test(line));
  assert.equal(errors.length, 0, `tsc أبلغ عن أخطاء:\n${errors.join('\n')}`);
});

test('لا imports أو متغيرات غير مستخدمة (TS6133)', () => {
  const output = runTsc(['--noUnusedLocals', '--noUnusedParameters']);
  const unused = output.split('\n').filter((line) => /error TS6133/.test(line));
  assert.equal(unused.length, 0, `عناصر ميتة:\n${unused.join('\n')}`);
});
