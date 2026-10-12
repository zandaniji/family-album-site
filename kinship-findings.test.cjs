// Review findings (2026-10-11): run with node --test kinship-findings.test.cjs.
// Each test reproduces a term or logic error found on a path the album's
// picker can reach; they now guard the fixes against regression.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(readFileSync(join(__dirname, 'vendor/kinship.js'), 'utf8'), context);
// Same options the album passes in album-interactive.js resolveAt().
const resolve = (path, egoGender = 'male', age = 'unknown', mode = 'address') =>
  context.Kinship.resolveKinship(path, {
    egoGender, targetRelativeAge: age, mode, familyAssumption: 'traditional-simple',
  });
// What fillResult() renders as the headline term(s).
const shown = result => (result.status === 'ambiguous' && result.candidates.length
  ? [...result.candidates] : [result.term]);

test('control: mother\'s father\'s father is 外曾祖父', () => {
  assert.equal(resolve(['mother', 'father', 'father'], 'male', 'unknown', 'reference').term, '外曾祖父');
});

test('father\'s mother\'s father is 曾外祖父, not 外曾祖父', () => {
  // 外曾祖父 = 母亲的祖父; 曾外祖父 = 父亲的外祖父 (《尔雅·释亲》 distinction).
  // The album also translates the term as "Maternal great-grandfather".
  assert.equal(resolve(['father', 'mother', 'father'], 'male', 'unknown', 'reference').term, '曾外祖父');
});

test('ambiguous candidates do not list the same relative twice in different registers', () => {
  // 哥哥的弟弟的哥哥 currently renders "我 / 哥 / 哥哥 / 弟弟".
  for (const path of [
    ['older_brother', 'younger_brother', 'older_brother'],
    ['older_brother', 'younger_brother', 'older_sister'],
    ['older_brother', 'younger_brother', 'younger_brother'],
  ]) {
    const terms = shown(resolve(path));
    const canonical = terms.map(term => ({ 哥: '哥哥', 弟: '弟弟', 姐: '姐姐', 妹: '妹妹' })[term] || term);
    assert.equal(new Set(canonical).size, terms.length, `${path.join(',')} → ${terms.join(' / ')}`);
  }
});

test('single sibling step shows the same word as the picker label', () => {
  // The right page says 哥哥; the reveal currently says 哥.
  assert.equal(resolve(['older_brother']).term, '哥哥');
});

test('brother\'s wife\'s father resolves like brother\'s wife\'s mother', () => {
  const mother = resolve(['older_brother', 'wife', 'mother']);
  const father = resolve(['older_brother', 'wife', 'father']);
  assert.equal(mother.term, '亲家母');
  assert.notEqual(father.status, 'descriptive', `got ${father.term}`);
});

test('father\'s father\'s wife offers 奶奶, consistent with father\'s wife → 母亲/继母', () => {
  const result = resolve(['father', 'father', 'wife']);
  assert.ok(shown(result).some(term => term === '奶奶' || term === '祖母'), `got ${shown(result).join(' / ')}`);
  assert.ok(!result.term.includes('姻亲'), 'a grandparent should not be labelled an in-law');
});

test('brother\'s son\'s son is 侄孙, not "no common term"', () => {
  const result = resolve(['older_brother', 'son', 'son']);
  assert.notEqual(result.status, 'descriptive', `got ${result.term}`);
});

test('in-law parents are distinguishable from own parents for both identities', () => {
  // The album headlines the written term and lists the spoken form beneath it:
  // 公公 is written, 爸爸 is what she says; her own father is written 父亲.
  const reference = (path, ego) => resolve(path, ego, 'unknown', 'reference');
  assert.equal(reference(['wife', 'father'], 'male').term, '岳父');
  const inLaw = reference(['husband', 'father'], 'female');
  assert.equal(inLaw.term, '公公');
  assert.notEqual(inLaw.term, reference(['father'], 'female').term);
  assert.ok(inLaw.terms.address.some(term => term.value === '爸爸'));
});

test('unspecified identity: the missing fact is ego gender, which the UI note hides', () => {
  // album-interactive.js fillResult() replaces missingFacts with "do the
  // intermediate relatives refer to the same person?" whenever there are
  // pathAlternatives, but here the only unknown is the visitor's own gender.
  const result = resolve(['son', 'mother'], 'unknown');
  assert.deepEqual(shown(result).sort(), ['我', '老婆'].sort());
  assert.ok(result.pathAlternatives.length > 1);
  assert.ok(result.missingFacts.some(fact => fact.includes('性别')));
});

test('added terms for great-grandparents, in-laws and grand-nephews', () => {
  const reference = (path, ego = 'male') => resolve(path, ego, 'unknown', 'reference');
  for (const [path, expected, ego] of [
    [['father', 'mother', 'mother'], '曾外祖母'],
    [['mother', 'mother', 'father'], '外曾外祖父'],
    [['older_sister', 'husband', 'father'], '亲家公'],
    [['younger_sister', 'husband', 'mother'], '亲家母'],
    [['older_brother', 'son', 'daughter'], '侄孙女'],
    [['younger_brother', 'daughter', 'son'], '侄外孙'],
    [['older_sister', 'son', 'son'], '外甥孙', 'female'],
    [['older_sister', 'daughter', 'daughter'], '外甥外孙女'],
    [['older_brother', 'son', 'wife'], '侄媳'],
    [['younger_sister', 'daughter', 'husband'], '外甥女婿'],
  ]) assert.equal(reference(path, ego).term, expected, path.join(','));
  for (const [path, candidates] of [
    [['father', 'mother', 'husband'], ['祖父', '继祖父']],
    [['mother', 'father', 'wife'], ['外祖母', '继外祖母']],
    [['mother', 'mother', 'husband'], ['外祖父', '继外祖父']],
  ]) assert.deepEqual([...reference(path).candidates], candidates, path.join(','));
});

test('spoken forms list the full sibling and cousin words people say', () => {
  const spoken = (path, age = 'unknown') => [...resolve(path, 'male', age, 'reference').terms.address].map(term => term.value);
  assert.deepEqual(spoken(['older_brother']), ['哥哥', '哥']);
  assert.deepEqual(spoken(['father', 'older_brother', 'son'], 'older'), ['堂哥']);
  assert.deepEqual(spoken(['mother', 'older_brother', 'son'], 'older'), ['表哥']);
});

test('a parent\'s spouse keeps the parent-or-step-parent ambiguity further along the path', () => {
  const reference = (path, age = 'unknown') => resolve(path, 'male', age, 'reference');
  assert.deepEqual([...reference(['father', 'wife', 'father']).candidates], ['外公', '继母的父亲']);
  assert.deepEqual([...reference(['mother', 'husband', 'older_brother']).candidates], ['伯父', '继父的哥哥']);
  const cousin = reference(['father', 'wife', 'older_brother', 'son'], 'older');
  assert.deepEqual([...cousin.candidates], ['表兄', '继母的哥哥的儿子']);
  assert.ok(!reference(['father', 'wife', 'older_sister']).term.includes('姻亲'));
});

test('spouse\'s nieces and nephews use their common terms', () => {
  assert.equal(resolve(['wife', 'older_brother', 'son'], 'male', 'unknown', 'reference').term, '内侄');
  assert.equal(resolve(['wife', 'younger_brother', 'daughter'], 'male', 'unknown', 'reference').term, '内侄女');
  assert.equal(resolve(['husband', 'older_brother', 'son'], 'female', 'unknown', 'reference').term, '侄子');
  assert.equal(resolve(['husband', 'younger_sister', 'daughter'], 'female', 'unknown', 'reference').term, '外甥女');
});

test('in-laws of a relative follow the connecting relative instead of a category label', () => {
  const reference = (path, age = 'unknown', ego = 'male') => resolve(path, ego, age, 'reference');
  const spoken = result => [...result.terms.address].map(term => term.value);
  const unknown = reference(['older_brother', 'wife', 'older_brother']);
  assert.equal(unknown.term, '嫂子的哥哥');
  assert.equal(unknown.resolutionStrategy, 'bridge-relative');
  assert.equal(unknown.needsTargetAge, true);
  assert.equal(unknown.termMetadata.bridge, '嫂子');
  assert.equal(unknown.termMetadata.bridgeAddress, '哥哥');
  assert.deepEqual([...unknown.termMetadata.spokenIfOlder], ['哥', '大哥']);
  assert.deepEqual(spoken(reference(['older_brother', 'wife', 'older_brother'], 'older')), ['哥', '大哥']);
  const younger = reference(['older_brother', 'wife', 'older_brother'], 'younger');
  assert.deepEqual(spoken(younger), []);
  assert.equal(younger.termMetadata.spokenByName, true);
  // A generation below: the daughter-in-law says 哥哥, but you use his name.
  const junior = reference(['son', 'wife', 'older_brother']);
  assert.equal(junior.term, '儿媳的哥哥');
  assert.equal(junior.needsTargetAge, false);
  assert.equal(junior.termMetadata.spokenByName, true);
  assert.equal(reference(['younger_sister', 'husband', 'older_sister'], 'unknown', 'female').term, '妹夫的姐姐');
});

test('a parent\'s cousins have their own terms: 堂舅 for mother\'s father\'s brother\'s son', () => {
  const reference = (path, age = 'unknown', ego = 'male') => resolve(path, ego, age, 'reference');
  const spoken = result => [...result.terms.address].map(term => term.value);
  // Reported: 妈妈 → 爸爸 → 哥哥 → 儿子 fell back to "母系男性长辈亲属".
  const uncle = reference(['mother', 'father', 'older_brother', 'son']);
  assert.equal(uncle.status, 'exact');
  assert.equal(uncle.term, '堂舅');
  assert.deepEqual(spoken(uncle), ['舅舅', '堂舅']);
  // 堂 only on the all-male line through the father's father; through any woman, 表.
  for (const [path, term] of [
    [['mother', 'father', 'younger_brother', 'daughter'], '堂姨'],
    [['mother', 'father', 'older_sister', 'son'], '表舅'],
    [['mother', 'mother', 'younger_brother', 'son'], '表舅'],
    [['mother', 'mother', 'older_sister', 'daughter'], '表姨'],
    [['father', 'father', 'older_brother', 'daughter'], '堂姑'],
    [['father', 'mother', 'older_sister', 'daughter'], '表姑'],
    [['mother', 'father', 'older_brother', 'son', 'wife'], '堂舅母'],
    [['father', 'mother', 'older_sister', 'daughter', 'husband'], '表姑父'],
  ]) assert.equal(reference(path).term, term, path.join(','));
  // A father's male cousin is 伯 or 叔 by age against the father, which the route cannot tell.
  for (const [path, candidates] of [
    [['father', 'father', 'older_brother', 'son'], ['堂伯', '堂叔']],
    [['father', 'father', 'older_sister', 'son'], ['表伯', '表叔']],
    [['father', 'mother', 'younger_brother', 'son'], ['表伯', '表叔']],
    [['father', 'father', 'older_brother', 'son', 'wife'], ['堂伯母', '堂婶']],
  ]) {
    const result = reference(path);
    assert.equal(result.status, 'ambiguous', path.join(','));
    assert.deepEqual([...result.candidates], candidates);
    assert.deepEqual([...result.missingFacts], ['他与你父亲的长幼关系']);
  }
});

test('second cousins are named as cousins, not "父系女性同辈亲属"', () => {
  const reference = (path, age = 'unknown', ego = 'male') => resolve(path, ego, age, 'reference');
  const spoken = result => [...result.terms.address].map(term => term.value);
  // Reported: 爸爸 → 妈妈 → 哥哥 → 儿子 → 女儿 (father's 表哥's daughter).
  const unknown = reference(['father', 'mother', 'older_brother', 'son', 'daughter']);
  assert.equal(unknown.status, 'ambiguous');
  assert.deepEqual([...unknown.candidates], ['远房表姐', '远房表妹']);
  assert.equal(unknown.needsTargetAge, true);
  const older = reference(['father', 'mother', 'older_brother', 'son', 'daughter'], 'older');
  assert.equal(older.term, '远房表姐');
  assert.deepEqual(spoken(older), ['表姐']);
  // The all-male line is 从堂, said aloud as 堂哥; 堂舅's children keep their compound.
  const congTang = reference(['father', 'father', 'older_brother', 'son', 'son'], 'older');
  assert.equal(congTang.term, '从堂哥');
  assert.deepEqual(spoken(congTang), ['堂哥']);
  const tangJiu = reference(['mother', 'father', 'older_brother', 'son', 'son'], 'younger');
  assert.equal(tangJiu.term, '堂舅表弟');
  assert.deepEqual(spoken(tangJiu), ['表弟']);
  assert.equal(reference(['mother', 'mother', 'older_sister', 'daughter', 'son'], 'younger').term, '远房表弟');
});
