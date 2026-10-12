// Review regressions: run with node --test kinship-review.test.cjs.
// Guards against endpoint-age leakage, lost ambiguity, and duplicate rewrites.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Load the exact browser artifact, independently of ancestor package settings.
const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, 'vendor/kinship.js'), 'utf8'), context);
// Written (reference) terms, as the album headlines them; ego appears as 自己.
const resolve = (path, age = 'unknown') => context.Kinship.resolveKinship(path, {
  egoGender: 'male', targetRelativeAge: age,
  mode: 'reference', familyAssumption: 'traditional-simple',
});
const possible = result => (result.status === 'ambiguous' ? [...result.candidates] : [result.term]);

test('control: paternal grandfather is resolved', () => {
  assert.equal(resolve(['father', 'father']).term, '爷爷');
});

test('control: age resolves a known paternal cousin', () => {
  assert.deepEqual(possible(resolve(['father', 'older_brother', 'son'], 'older')), ['堂兄']);
});

test('control: age resolves a parent-child round trip at the endpoint', () => {
  assert.deepEqual(possible(resolve(['father', 'son'], 'older')), ['哥哥']);
});

for (const [name, path] of [
  ['intermediate parent-child round trip', ['father', 'father', 'son', 'son']],
  ['intermediate sibling round trip', ['father', 'older_brother', 'younger_brother', 'son']],
]) {
  for (const [age, expected] of [
    ['older', ['哥哥', '堂兄']],
    ['younger', ['弟弟', '堂弟']],
  ]) {
    test(`${name}: ${age} endpoint must retain sibling and cousin possibilities`, () => {
      // Grandpa's son / uncle's younger brother can still be Dad.
      // The final person's age relative to me says nothing about that identity.
      const actual = possible(resolve(path, age)).sort();
      assert.deepEqual(actual, [...expected].sort());
    });
  }
}

test('ten selectable sibling steps should produce candidates without throwing', () => {
  const path = Array.from({ length: 10 }, (_, index) =>
    index % 2 ? 'younger_brother' : 'older_brother');
  let result;
  assert.doesNotThrow(() => { result = resolve(path); });
  assert.equal(result.status, 'ambiguous');
  assert.ok(possible(result).includes('自己'));
  assert.ok(result.normalization.exploredStates <= 1024);
});

test('overlapping sibling rewrites exclude candidates contradicting endpoint age', () => {
  const path = ['older_brother', 'younger_brother', 'older_brother'];
  assert.deepEqual(possible(resolve(path, 'younger')), ['弟弟']);
  assert.deepEqual(possible(resolve(path, 'older')), ['哥哥']);
});

test('an older endpoint cannot be ego after a round trip', () => {
  assert.throws(() => resolve(['son', 'father'], 'older'), { code: 'INCONSISTENT_AGE' });
});

test('endpoint age does not determine an uncle\'s age relative to Dad', () => {
  for (const age of ['unknown', 'older', 'younger']) {
    const result = resolve(['father', 'father', 'son'], age);
    assert.deepEqual(possible(result).sort(), ['父亲', '伯父', '叔父'].sort());
    assert.equal(result.needsTargetAge, false);
  }
});

test('endpoint age does not determine a wife\'s brother\'s age relative to her', () => {
  for (const age of ['unknown', 'older', 'younger', 'same']) {
    const result = resolve(['wife', 'father', 'son'], age);
    assert.deepEqual(possible(result).sort(), ['大舅子', '小舅子'].sort());
    assert.equal(result.needsTargetAge, false);
  }
});

test('contextual spouse-family terms do not inherit the ego\'s age comparison', () => {
  const result = resolve(['wife', 'father', 'older_brother', 'son'], 'older');
  assert.deepEqual(possible(result).sort(), ['妻子的堂兄', '妻子的堂弟'].sort());
  assert.equal(result.needsTargetAge, false);
  assert.ok(result.missingFacts.some(fact => fact.includes('与配偶')));
});

test('age prompts describe the comparison that actually resolves the term', () => {
  assert.equal(resolve(['father', 'son']).needsTargetAge, true);
  assert.equal(resolve(['father', 'older_brother', 'son']).needsTargetAge, true);
  assert.equal(resolve(['father', 'father', 'son', 'son']).needsTargetAge, true);
  assert.equal(resolve(['father', 'father', 'son', 'son'], 'older').needsTargetAge, false);
  assert.equal(resolve(['father', 'son', 'wife']).needsTargetAge, false);
});

test('female endpoints preserve sister and cousin alternatives', () => {
  const result = context.Kinship.resolveKinship(['father', 'father', 'son', 'daughter'], {
    egoGender: 'female', targetRelativeAge: 'older', mode: 'reference',
  });
  assert.deepEqual([...result.candidates].sort(), ['姐姐', '堂姐'].sort());
  assert.equal(result.status, 'ambiguous');
});

test('reverse relationships invert endpoint age without losing sibling possibilities', () => {
  const result = resolve(['father', 'father', 'son', 'son'], 'older');
  assert.deepEqual(possible(result.reverse).sort(), ['弟弟', '堂弟'].sort());
});
