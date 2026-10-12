(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Kinship = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GENDERS = ['male', 'female', 'unknown'];
  const RELATIVE_AGES = ['older', 'younger', 'same', 'unknown'];
  const MAX_INPUT_STEPS = 64;
  const MAX_REWRITE_STATES = 1024;
  const EGO_TOKENS = new Set(['我', '自己', 'me', 'i', 'self', 'ego']);

  const ATOMS = {
    father: { relation: 'parent', gender: 'male', label: '父亲' },
    mother: { relation: 'parent', gender: 'female', label: '母亲' },
    son: { relation: 'child', gender: 'male', label: '儿子' },
    daughter: { relation: 'child', gender: 'female', label: '女儿' },
    husband: { relation: 'spouse', gender: 'male', label: '丈夫' },
    wife: { relation: 'spouse', gender: 'female', label: '妻子' },
    older_brother: { relation: 'sibling', gender: 'male', seniority: 'older', label: '哥哥' },
    younger_brother: { relation: 'sibling', gender: 'male', seniority: 'younger', label: '弟弟' },
    brother: { relation: 'sibling', gender: 'male', seniority: 'unknown', label: '兄弟' },
    older_sister: { relation: 'sibling', gender: 'female', seniority: 'older', label: '姐姐' },
    younger_sister: { relation: 'sibling', gender: 'female', seniority: 'younger', label: '妹妹' },
    sister: { relation: 'sibling', gender: 'female', seniority: 'unknown', label: '姐妹' },
  };

  const ALIASES = {
    father: 'father', dad: 'father', '父亲': 'father', '爸爸': 'father', '爸': 'father',
    mother: 'mother', mom: 'mother', '母亲': 'mother', '妈妈': 'mother', '妈': 'mother',
    son: 'son', '儿子': 'son', '儿': 'son',
    daughter: 'daughter', '女儿': 'daughter',
    husband: 'husband', '丈夫': 'husband', '老公': 'husband',
    wife: 'wife', '妻子': 'wife', '老婆': 'wife',
    older_brother: 'older_brother', '哥哥': 'older_brother', '哥': 'older_brother', '大哥': 'older_brother',
    younger_brother: 'younger_brother', '弟弟': 'younger_brother', '弟': 'younger_brother',
    brother: 'brother', '兄弟': 'brother',
    older_sister: 'older_sister', '姐姐': 'older_sister', '姐': 'older_sister', '大姐': 'older_sister',
    younger_sister: 'younger_sister', '妹妹': 'younger_sister', '妹': 'younger_sister',
    sister: 'sister', '姐妹': 'sister',
    grandfather: ['father', 'father'], '爷爷': ['father', 'father'], '祖父': ['father', 'father'],
    grandmother: ['father', 'mother'], '奶奶': ['father', 'mother'], '祖母': ['father', 'mother'],
    maternal_grandfather: ['mother', 'father'], '外公': ['mother', 'father'], '姥爷': ['mother', 'father'], '外祖父': ['mother', 'father'],
    maternal_grandmother: ['mother', 'mother'], '外婆': ['mother', 'mother'], '姥姥': ['mother', 'mother'], '外祖母': ['mother', 'mother'],
    paternal_older_uncle: ['father', 'older_brother'], '伯父': ['father', 'older_brother'], '伯伯': ['father', 'older_brother'], '大伯': ['father', 'older_brother'],
    paternal_younger_uncle: ['father', 'younger_brother'], '叔父': ['father', 'younger_brother'], '叔叔': ['father', 'younger_brother'],
    paternal_aunt: ['father', 'sister'], '姑母': ['father', 'sister'], '姑妈': ['father', 'sister'], '姑姑': ['father', 'sister'],
    maternal_uncle: ['mother', 'brother'], '舅父': ['mother', 'brother'], '舅舅': ['mother', 'brother'],
    maternal_aunt: ['mother', 'sister'], '姨母': ['mother', 'sister'], '姨妈': ['mother', 'sister'], '阿姨': ['mother', 'sister'],
    '曾祖父': ['father', 'father', 'father'], '太爷爷': ['father', 'father', 'father'],
    '曾祖母': ['father', 'father', 'mother'], '太奶奶': ['father', 'father', 'mother'],
    '外曾祖父': ['mother', 'father', 'father'],
    '外曾祖母': ['mother', 'father', 'mother'],
    '曾外祖父': ['father', 'mother', 'father'],
    '曾外祖母': ['father', 'mother', 'mother'],
    '外曾外祖父': ['mother', 'mother', 'father'],
    '外曾外祖母': ['mother', 'mother', 'mother'],
    '高祖父': ['father', 'father', 'father', 'father'],
    '高祖母': ['father', 'father', 'father', 'mother'],
    '侄子': ['older_brother', 'son'], '侄': ['older_brother', 'son'], '侄儿': ['older_brother', 'son'],
    '侄女': ['older_brother', 'daughter'],
    '外甥': ['older_sister', 'son'],
    '外甥女': ['older_sister', 'daughter'],
    '孙子': ['son', 'son'], '孙': ['son', 'son'],
    '孙女': ['son', 'daughter'],
    '外孙': ['daughter', 'son'],
    '外孙女': ['daughter', 'daughter'],
    '儿媳': ['son', 'wife'], '儿媳妇': ['son', 'wife'],
    '女婿': ['daughter', 'husband'],
    '嫂子': ['older_brother', 'wife'], '嫂': ['older_brother', 'wife'],
    '弟媳': ['younger_brother', 'wife'], '弟妹': ['younger_brother', 'wife'],
    '姐夫': ['older_sister', 'husband'],
    '妹夫': ['younger_sister', 'husband'],
    '岳父': ['wife', 'father'], '岳丈': ['wife', 'father'],
    '岳母': ['wife', 'mother'],
    '公公': ['husband', 'father'],
    '婆婆': ['husband', 'mother'],
    '伯母': ['father', 'older_brother', 'wife'],
    '婶母': ['father', 'younger_brother', 'wife'], '婶婶': ['father', 'younger_brother', 'wife'], '婶': ['father', 'younger_brother', 'wife'],
    '姑父': ['father', 'sister', 'husband'], '姑丈': ['father', 'sister', 'husband'],
    '舅母': ['mother', 'brother', 'wife'], '舅妈': ['mother', 'brother', 'wife'],
    '姨父': ['mother', 'sister', 'husband'], '姨夫': ['mother', 'sister', 'husband'],
    '堂兄': { tokens: ['father', 'brother', 'son'], targetRelativeAge: 'older' },
    '堂哥': { tokens: ['father', 'brother', 'son'], targetRelativeAge: 'older' },
    '堂弟': { tokens: ['father', 'brother', 'son'], targetRelativeAge: 'younger' },
    '堂姐': { tokens: ['father', 'brother', 'daughter'], targetRelativeAge: 'older' },
    '堂妹': { tokens: ['father', 'brother', 'daughter'], targetRelativeAge: 'younger' },
    '堂兄弟': ['father', 'brother', 'son'],
    '堂姐妹': ['father', 'brother', 'daughter'],
    '堂侄': ['father', 'brother', 'son', 'son'],
    '堂侄女': ['father', 'brother', 'son', 'daughter'],
    '堂外甥': ['father', 'brother', 'daughter', 'son'],
    '堂外甥女': ['father', 'brother', 'daughter', 'daughter'],
    '表兄': { tokens: ['mother', 'brother', 'son'], targetRelativeAge: 'older' },
    '表哥': { tokens: ['mother', 'brother', 'son'], targetRelativeAge: 'older' },
    '表弟': { tokens: ['mother', 'brother', 'son'], targetRelativeAge: 'younger' },
    '表姐': { tokens: ['mother', 'brother', 'daughter'], targetRelativeAge: 'older' },
    '表妹': { tokens: ['mother', 'brother', 'daughter'], targetRelativeAge: 'younger' },
    '大舅子': ['wife', 'older_brother'],
    '小舅子': ['wife', 'younger_brother'],
    '大姨子': ['wife', 'older_sister'],
    '小姨子': ['wife', 'younger_sister'],
    '大伯子': ['husband', 'older_brother'],
    '小叔子': ['husband', 'younger_brother'],
    '大姑子': ['husband', 'older_sister'],
    '小姑子': ['husband', 'younger_sister'],
    '连襟': ['wife', 'sister', 'husband'],
    '亲家公': ['son', 'wife', 'father'],
    '亲家母': ['son', 'wife', 'mother'],
    '伯公': ['father', 'father', 'older_brother'],
    '叔公': ['father', 'father', 'younger_brother'],
    '姑婆': ['father', 'father', 'sister'],
    '舅公': ['father', 'mother', 'brother'],
    '姨婆': ['father', 'mother', 'sister'],
  };

  const term = (value, register, note) => ({
    value,
    register: register || 'neutral',
    ...(note ? { note } : {}),
  });

  // A locale term pack maps a normalized structural role to language. It is
  // intentionally separate from path rules: many different input paths can
  // normalize to the same role, while another locale can render it differently.
  const STRUCTURAL_TERM_PACKS = {
    'zh-Hans-CN': {
      paternalGrandfatherCollateral: {
        'male:older:self': { reference: ['伯公', '伯祖父'], address: ['伯公'] },
        'male:younger:self': { reference: ['叔公', '叔祖父'], address: ['叔公'] },
        'female:older:self': { reference: ['姑婆', '姑祖母'], address: ['姑婆'] },
        'female:younger:self': { reference: ['姑婆', '姑祖母'], address: ['姑婆'] },
        'female:unknown:self': { reference: ['姑婆', '姑祖母'], address: ['姑婆'] },
        'male:older:spouse:female': { reference: ['伯婆', '伯祖母'], address: ['伯婆'] },
        'male:younger:spouse:female': { reference: ['叔婆', '叔祖母'], address: ['叔婆'] },
        'female:older:spouse:male': { reference: ['姑公', '姑祖父'], address: ['姑公'] },
        'female:younger:spouse:male': { reference: ['姑公', '姑祖父'], address: ['姑公'] },
        'female:unknown:spouse:male': { reference: ['姑公', '姑祖父'], address: ['姑公'] },
      },
      grandparentCollateral: {
        'male-female:male:older:self': { reference: ['舅公', '舅祖父'], address: ['舅公'] },
        'male-female:male:younger:self': { reference: ['舅公', '舅祖父'], address: ['舅公'] },
        'male-female:male:unknown:self': { reference: ['舅公', '舅祖父'], address: ['舅公'] },
        'male-female:female:older:self': { reference: ['姨婆', '姨祖母'], address: ['姨婆'] },
        'male-female:female:younger:self': { reference: ['姨婆', '姨祖母'], address: ['姨婆'] },
        'male-female:female:unknown:self': { reference: ['姨婆', '姨祖母'], address: ['姨婆'] },
        'male-female:male:older:spouse:female': { reference: ['舅婆', '舅祖母'], address: ['舅婆'] },
        'male-female:male:younger:spouse:female': { reference: ['舅婆', '舅祖母'], address: ['舅婆'] },
        'male-female:male:unknown:spouse:female': { reference: ['舅婆', '舅祖母'], address: ['舅婆'] },
        'male-female:female:older:spouse:male': { reference: ['姨公', '姨祖父'], address: ['姨公'] },
        'male-female:female:younger:spouse:male': { reference: ['姨公', '姨祖父'], address: ['姨公'] },
        'male-female:female:unknown:spouse:male': { reference: ['姨公', '姨祖父'], address: ['姨公'] },
        'female-male:male:older:self': { reference: ['外伯公', '外伯祖父'], address: ['外伯公'] },
        'female-male:male:younger:self': { reference: ['外叔公', '外叔祖父'], address: ['外叔公'] },
        'female-male:male:unknown:self': { reference: ['外伯叔公'], address: ['外伯公'] },
        'female-male:female:older:self': { reference: ['外姑婆', '外姑祖母'], address: ['外姑婆'] },
        'female-male:female:younger:self': { reference: ['外姑婆', '外姑祖母'], address: ['外姑婆'] },
        'female-male:female:unknown:self': { reference: ['外姑婆', '外姑祖母'], address: ['外姑婆'] },
        'female-female:male:older:self': { reference: ['外舅公'], address: ['外舅公'] },
        'female-female:male:younger:self': { reference: ['外舅公'], address: ['外舅公'] },
        'female-female:male:unknown:self': { reference: ['外舅公'], address: ['外舅公'] },
        'female-female:female:older:self': { reference: ['外姨婆'], address: ['外姨婆'] },
        'female-female:female:younger:self': { reference: ['外姨婆'], address: ['外姨婆'] },
        'female-female:female:unknown:self': { reference: ['外姨婆'], address: ['外姨婆'] },
      },
      linealAncestor: {
        'male-male-male': { reference: ['曾祖父'], address: ['太爷爷'] },
        'male-male-female': { reference: ['曾祖母'], address: ['太奶奶'] },
        // 曾外祖父 is the father's maternal grandfather; 外曾祖父 is the
        // mother's paternal grandfather (《尔雅·释亲》: 母之王考为外曾王父).
        'male-female-male': { reference: ['曾外祖父'], address: [] },
        'male-female-female': { reference: ['曾外祖母'], address: [] },
        'female-male-male': { reference: ['外曾祖父'], address: ['太外公', '太姥爷'] },
        'female-male-female': { reference: ['外曾祖母'], address: ['太外婆', '太姥姥'] },
        'female-female-male': { reference: ['外曾外祖父'], address: ['太外公', '太姥爷'] },
        'female-female-female': { reference: ['外曾外祖母'], address: ['太外婆', '太姥姥'] },
        'male-male-male-male': { reference: ['高祖父'], address: ['高祖父'] },
        'male-male-male-female': { reference: ['高祖母'], address: ['高祖母'] },
      },
      spouseCollateralDescendant: {
        // The wildcard means the husband's brother may be older, younger, or
        // of unknown seniority without multiplying raw path rules.
        'male:male:*:female:spouse:male': {
          reference: ['叔侄女婿', '丈夫兄弟的女儿之夫'],
          address: [],
        },
      },
      spouseImmediateCollateral: {
        'female:male:older': { reference: ['大舅子'], address: [] },
        'female:male:younger': { reference: ['小舅子'], address: [] },
        'female:female:older': { reference: ['大姨子'], address: [] },
        'female:female:younger': { reference: ['小姨子'], address: [] },
        'male:male:older': { reference: ['大伯子'], address: [] },
        'male:male:younger': { reference: ['小叔子'], address: [] },
        'male:female:older': { reference: ['大姑子'], address: [] },
        'male:female:younger': { reference: ['小姑子'], address: [] },
      },
      // A parent's cousins: a grandparent's sibling's child, and that cousin's
      // spouse. Key = ancestor genders : grandparent's sibling gender : cousin
      // gender : endpoint. 堂 marks the all-male line through the father's
      // father (堂伯, 堂舅 = 母亲的堂兄弟); any line through a woman is 表. On the
      // father's side a male cousin is 伯 or 叔 by age against the father, which
      // the route cannot tell, so those entries carry both.
      parentCousin: {
        'male-male:male:male:self': { generic: '堂伯叔', older: { reference: ['堂伯'], address: ['伯伯', '堂伯'] }, younger: { reference: ['堂叔'], address: ['叔叔', '堂叔'] } },
        'male-male:male:male:spouse:female': { generic: '堂伯婶', older: { reference: ['堂伯母'], address: ['伯母'] }, younger: { reference: ['堂婶'], address: ['婶婶'] } },
        'male-male:male:female:self': { reference: ['堂姑'], address: ['姑姑', '堂姑'] },
        'male-male:male:female:spouse:male': { reference: ['堂姑父'], address: ['姑父'] },
        'male-male:female:male:self': { generic: '表伯叔', older: { reference: ['表伯'], address: ['伯伯', '表伯'] }, younger: { reference: ['表叔'], address: ['叔叔', '表叔'] } },
        'male-male:female:male:spouse:female': { generic: '表伯婶', older: { reference: ['表伯母'], address: ['伯母'] }, younger: { reference: ['表婶'], address: ['婶婶'] } },
        'male-male:female:female:self': { reference: ['表姑'], address: ['姑姑', '表姑'] },
        'male-male:female:female:spouse:male': { reference: ['表姑父'], address: ['姑父'] },
        'male-female:male:male:self': { generic: '表伯叔', older: { reference: ['表伯'], address: ['伯伯', '表伯'] }, younger: { reference: ['表叔'], address: ['叔叔', '表叔'] } },
        'male-female:male:male:spouse:female': { generic: '表伯婶', older: { reference: ['表伯母'], address: ['伯母'] }, younger: { reference: ['表婶'], address: ['婶婶'] } },
        'male-female:female:male:self': { generic: '表伯叔', older: { reference: ['表伯'], address: ['伯伯', '表伯'] }, younger: { reference: ['表叔'], address: ['叔叔', '表叔'] } },
        'male-female:female:male:spouse:female': { generic: '表伯婶', older: { reference: ['表伯母'], address: ['伯母'] }, younger: { reference: ['表婶'], address: ['婶婶'] } },
        'male-female:male:female:self': { reference: ['表姑'], address: ['姑姑', '表姑'] },
        'male-female:male:female:spouse:male': { reference: ['表姑父'], address: ['姑父'] },
        'male-female:female:female:self': { reference: ['表姑'], address: ['姑姑', '表姑'] },
        'male-female:female:female:spouse:male': { reference: ['表姑父'], address: ['姑父'] },
        'female-male:male:male:self': { reference: ['堂舅'], address: ['舅舅', '堂舅'] },
        'female-male:male:male:spouse:female': { reference: ['堂舅母'], address: ['舅妈'] },
        'female-male:male:female:self': { reference: ['堂姨'], address: ['阿姨', '堂姨'] },
        'female-male:male:female:spouse:male': { reference: ['堂姨父'], address: ['姨父'] },
        'female-male:female:male:self': { reference: ['表舅'], address: ['舅舅', '表舅'] },
        'female-male:female:male:spouse:female': { reference: ['表舅母'], address: ['舅妈'] },
        'female-male:female:female:self': { reference: ['表姨'], address: ['阿姨', '表姨'] },
        'female-male:female:female:spouse:male': { reference: ['表姨父'], address: ['姨父'] },
        'female-female:male:male:self': { reference: ['表舅'], address: ['舅舅', '表舅'] },
        'female-female:male:male:spouse:female': { reference: ['表舅母'], address: ['舅妈'] },
        'female-female:female:male:self': { reference: ['表舅'], address: ['舅舅', '表舅'] },
        'female-female:female:male:spouse:female': { reference: ['表舅母'], address: ['舅妈'] },
        'female-female:male:female:self': { reference: ['表姨'], address: ['阿姨', '表姨'] },
        'female-female:male:female:spouse:male': { reference: ['表姨父'], address: ['姨父'] },
        'female-female:female:female:self': { reference: ['表姨'], address: ['阿姨', '表姨'] },
        'female-female:female:female:spouse:male': { reference: ['表姨父'], address: ['姨父'] },
      },
      // Second cousins: a parent's cousin's child, in one's own generation.
      // Key = ancestor genders : branch gender : first descendant gender.
      // The final descendant is the peer whose 哥/弟/姐/妹 suffix is rendered;
      // spoken is the prefix people say aloud (从堂哥 is called 堂哥).
      // The all-male line is 从堂 (再从); the children of 堂姑、堂舅、堂姨 keep
      // their compound names; every other line through a woman is 远房表.
      extendedPeerBranches: {
        'male-male:male:male': { id: 'cong-tang', prefix: '从堂', spoken: '堂' },
        'male-male:male:female': { id: 'tang-gu-biao', prefix: '堂姑表', spoken: '表' },
        'female-male:male:male': { id: 'tang-jiu-biao', prefix: '堂舅表', spoken: '表' },
        'female-male:male:female': { id: 'tang-yi-biao', prefix: '堂姨表', spoken: '表' },
        'male-male:female:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'male-male:female:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'male-female:male:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'male-female:male:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'male-female:female:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'male-female:female:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-male:female:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-male:female:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-female:male:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-female:male:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-female:female:male': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
        'female-female:female:female': { id: 'yuan-fang-biao', prefix: '远房表', spoken: '表' },
      },
      // One-generation-lower descendants of cousins.
      // A male cousin's children are 侄, a female cousin's children are 甥.
      collateralDescendantBranches: {
        'male:male:male': { id: 'tang-zhi', prefix: '堂', relation: '侄' },
        'male:male:female': { id: 'tang-sheng', prefix: '堂', relation: '甥' },
        'male:female:male': { id: 'gu-biao-zhi', prefix: '姑表', relation: '侄' },
        'male:female:female': { id: 'gu-biao-sheng', prefix: '姑表', relation: '甥' },
        'female:male:male': { id: 'jiu-biao-zhi', prefix: '舅表', relation: '侄' },
        'female:male:female': { id: 'jiu-biao-sheng', prefix: '舅表', relation: '甥' },
        'female:female:male': { id: 'yi-biao-zhi', prefix: '姨表', relation: '侄' },
        'female:female:female': { id: 'yi-biao-sheng', prefix: '姨表', relation: '甥' },
      },
      // Key = ancestors : first branch gender : spouse gender : spouse-family branch gender.
      affinalPeerBranches: {
        'female:female:male:female': { id: 'yi-yin-gu-biao', prefix: '姨姻姑表' },
      },
      linealDescendant: {
        'male-male:self': { reference: ['孙子'], address: [] },
        'male-female:self': { reference: ['孙女'], address: [] },
        'female-male:self': { reference: ['外孙'], address: [] },
        'female-female:self': { reference: ['外孙女'], address: [] },
        'male-male:spouse:female': { reference: ['孙媳妇'], address: [] },
        'male-female:spouse:male': { reference: ['孙女婿'], address: [] },
        'female-male:spouse:female': { reference: ['外孙媳妇'], address: [] },
        'female-female:spouse:male': { reference: ['外孙女婿'], address: [] },
      },
      descendantGenerations: {
        1: { male: '子', female: '女', usage: '日常、礼制' },
        2: { male: '孙', female: '孙女', usage: '日常、礼制' },
        3: { male: '曾孙', female: '曾孙女', usage: '礼制常用' },
        4: { male: '玄孙', female: '玄孙女', usage: '九族下界、五服边缘；正式礼制称谓' },
        5: { male: '来孙', female: '来孙女', usage: '古称，日常几乎不用' },
        6: { male: '晜孙', female: '晜孙女', usage: '古称' },
        7: { male: '仍孙', female: '仍孙女', usage: '古称' },
        8: { male: '云孙', female: '云孙女', usage: '古称' },
        9: { male: '耳孙', female: '耳孙女', usage: '古称极限，谱牒或古书使用' },
      },
    },
  };

  const rules = [
    rule('self', [], ['自己'], ['我'], 200),
    rule('direct-father', [p('parent', 'male')], ['父亲'], ['爸爸'], 100),
    rule('direct-mother', [p('parent', 'female')], ['母亲'], ['妈妈'], 100),
    rule('direct-son', [p('child', 'male')], ['儿子'], [], 100),
    rule('direct-daughter', [p('child', 'female')], ['女儿'], [], 100),
    rule('direct-husband', [p('spouse', 'male')], ['丈夫'], ['老公'], 100),
    rule('direct-wife', [p('spouse', 'female')], ['妻子'], ['老婆'], 100),
    rule('sibling-older-brother', [p('sibling', 'male', 'older')], ['哥哥'], ['哥哥', '哥'], 100),
    rule('sibling-younger-brother', [p('sibling', 'male', 'younger')], ['弟弟'], ['弟弟', '弟'], 100),
    ambiguousRule('sibling-brother-unknown', [p('sibling', 'male', 'unknown')], '兄弟', ['哥哥', '弟弟'], '他与你的长幼关系', 90, { targetRelativeAge: 'unknown' }),
    rule('sibling-brother-same', [p('sibling', 'male', 'unknown')], ['兄弟'], [], 95, { targetRelativeAge: 'same' }),
    rule('sibling-brother-context-older', [p('sibling', 'male', 'unknown')], ['哥哥'], ['哥哥', '哥'], 96, { targetRelativeAge: 'older' }),
    rule('sibling-brother-context-younger', [p('sibling', 'male', 'unknown')], ['弟弟'], ['弟弟', '弟'], 96, { targetRelativeAge: 'younger' }),
    rule('sibling-older-sister', [p('sibling', 'female', 'older')], ['姐姐'], ['姐姐', '姐'], 100),
    rule('sibling-younger-sister', [p('sibling', 'female', 'younger')], ['妹妹'], ['妹妹', '妹'], 100),
    ambiguousRule('sibling-sister-unknown', [p('sibling', 'female', 'unknown')], '姐妹', ['姐姐', '妹妹'], '她与你的长幼关系', 90, { targetRelativeAge: 'unknown' }),
    rule('sibling-sister-same', [p('sibling', 'female', 'unknown')], ['姐妹'], [], 95, { targetRelativeAge: 'same' }),
    rule('sibling-sister-context-older', [p('sibling', 'female', 'unknown')], ['姐姐'], ['姐姐', '姐'], 96, { targetRelativeAge: 'older' }),
    rule('sibling-sister-context-younger', [p('sibling', 'female', 'unknown')], ['妹妹'], ['妹妹', '妹'], 96, { targetRelativeAge: 'younger' }),

    rule('paternal-grandfather', [p('parent', 'male'), p('parent', 'male')], ['爷爷', '祖父'], ['爷爷'], 110),
    rule('paternal-grandmother', [p('parent', 'male'), p('parent', 'female')], ['奶奶', '祖母'], ['奶奶'], 110),
    rule('maternal-grandfather', [p('parent', 'female'), p('parent', 'male')], ['外公', '外祖父'], ['外公', '姥爷'], 110),
    rule('maternal-grandmother', [p('parent', 'female'), p('parent', 'female')], ['外婆', '外祖母'], ['外婆', '姥姥'], 110),
    rule('sons-son', [p('child', 'male'), p('child', 'male')], ['孙子'], [], 110),
    rule('sons-daughter', [p('child', 'male'), p('child', 'female')], ['孙女'], [], 110),
    rule('daughters-son', [p('child', 'female'), p('child', 'male')], ['外孙'], [], 110),
    rule('daughters-daughter', [p('child', 'female'), p('child', 'female')], ['外孙女'], [], 110),

    rule('paternal-uncle-older', [p('parent', 'male'), p('sibling', 'male', 'older')], ['伯父'], ['伯伯', '大伯'], 130),
    rule('paternal-uncle-younger', [p('parent', 'male'), p('sibling', 'male', 'younger')], ['叔父'], ['叔叔'], 130),
    ambiguousRule('paternal-uncle-unknown', [p('parent', 'male'), p('sibling', 'male', 'unknown')], '伯叔', ['伯父', '叔父'], '他与你父亲的长幼关系', 120),
    rule('paternal-aunt', [p('parent', 'male'), p('sibling', 'female')], ['姑母'], ['姑姑'], 125),
    rule('maternal-uncle', [p('parent', 'female'), p('sibling', 'male')], ['舅父'], ['舅舅'], 125),
    rule('maternal-aunt', [p('parent', 'female'), p('sibling', 'female')], ['姨母'], ['姨妈', '阿姨'], 125),

    rule('paternal-older-uncles-wife', [p('parent', 'male'), p('sibling', 'male', 'older'), p('spouse', 'female')], ['伯母'], ['伯母', '大娘'], 140),
    rule('paternal-younger-uncles-wife', [p('parent', 'male'), p('sibling', 'male', 'younger'), p('spouse', 'female')], ['婶母'], ['婶婶'], 140),
    ambiguousRule('paternal-uncles-wife-unknown', [p('parent', 'male'), p('sibling', 'male', 'unknown'), p('spouse', 'female')], '伯婶', ['伯母', '婶母'], '他与你父亲的长幼关系', 135),
    rule('paternal-aunts-husband', [p('parent', 'male'), p('sibling', 'female'), p('spouse', 'male')], ['姑父'], ['姑父'], 140),
    rule('maternal-uncles-wife', [p('parent', 'female'), p('sibling', 'male'), p('spouse', 'female')], ['舅母'], ['舅妈'], 140),
    rule('maternal-aunts-husband', [p('parent', 'female'), p('sibling', 'female'), p('spouse', 'male')], ['姨父'], ['姨夫'], 140),

    rule('wifes-father', [p('spouse', 'female'), p('parent', 'male')], ['岳父'], ['岳父', '爸爸'], 130),
    rule('wifes-mother', [p('spouse', 'female'), p('parent', 'female')], ['岳母'], ['岳母', '妈妈'], 130),
    rule('husbands-father', [p('spouse', 'male'), p('parent', 'male')], ['公公'], ['爸爸'], 130),
    rule('husbands-mother', [p('spouse', 'male'), p('parent', 'female')], ['婆婆'], ['妈妈'], 130),
    rule('sons-wife', [p('child', 'male'), p('spouse', 'female')], ['儿媳'], [], 130),
    rule('daughters-husband', [p('child', 'female'), p('spouse', 'male')], ['女婿'], [], 130),
    rule('older-brothers-wife', [p('sibling', 'male', 'older'), p('spouse', 'female')], ['嫂子'], ['嫂子'], 130),
    rule('younger-brothers-wife', [p('sibling', 'male', 'younger'), p('spouse', 'female')], ['弟媳'], [], 130),
    ambiguousRule('brothers-wife-unknown', [p('sibling', 'male', 'unknown'), p('spouse', 'female')], '兄弟的妻子', ['嫂子', '弟媳'], '他与你的长幼关系', 120),
    rule('older-sisters-husband', [p('sibling', 'female', 'older'), p('spouse', 'male')], ['姐夫'], ['姐夫'], 130),
    rule('younger-sisters-husband', [p('sibling', 'female', 'younger'), p('spouse', 'male')], ['妹夫'], [], 130),
    ambiguousRule('sisters-husband-unknown', [p('sibling', 'female', 'unknown'), p('spouse', 'male')], '姐妹的丈夫', ['姐夫', '妹夫'], '她与你的长幼关系', 120),
    rule(
      'child-in-laws-mother',
      [p('child'), p('spouse'), p('parent', 'female')],
      ['亲家母'],
      [],
      145,
    ),
    rule(
      'child-in-laws-father',
      [p('child'), p('spouse'), p('parent', 'male')],
      ['亲家公'],
      [],
      145,
    ),
    rule(
      'wifes-older-sisters-husband',
      [p('spouse', 'female'), p('sibling', 'female', 'older'), p('spouse', 'male')],
      ['连襟', '襟兄'],
      [],
      145,
    ),
    rule(
      'wifes-younger-sisters-husband',
      [p('spouse', 'female'), p('sibling', 'female', 'younger'), p('spouse', 'male')],
      ['连襟', '襟弟'],
      [],
      145,
    ),
    ambiguousRule(
      'wifes-sisters-husband-unknown',
      [p('spouse', 'female'), p('sibling', 'female', 'unknown'), p('spouse', 'male')],
      '连襟',
      ['襟兄', '襟弟'],
      '需要确认妻姐与妻妹的长幼',
      140,
    ),
    rule(
      'brothers-wifes-mother',
      [p('sibling', 'male'), p('spouse', 'female'), p('parent', 'female')],
      ['亲家母', '兄弟眷母'],
      [],
      145,
    ),

    rule('brothers-wifes-father', [p('sibling', 'male'), p('spouse', 'female'), p('parent', 'male')], ['亲家公'], [], 145),
    rule('sisters-husbands-father', [p('sibling', 'female'), p('spouse', 'male'), p('parent', 'male')], ['亲家公'], [], 145),
    rule('sisters-husbands-mother', [p('sibling', 'female'), p('spouse', 'male'), p('parent', 'female')], ['亲家母'], [], 145),

    rule('wifes-brothers-son', [p('spouse', 'female'), p('sibling', 'male'), p('child', 'male')], ['内侄'], [], 140),
    rule('wifes-brothers-daughter', [p('spouse', 'female'), p('sibling', 'male'), p('child', 'female')], ['内侄女'], [], 140),
    rule('husbands-brothers-son', [p('spouse', 'male'), p('sibling', 'male'), p('child', 'male')], ['侄子'], [], 140),
    rule('husbands-brothers-daughter', [p('spouse', 'male'), p('sibling', 'male'), p('child', 'female')], ['侄女'], [], 140),
    rule('husbands-sisters-son', [p('spouse', 'male'), p('sibling', 'female'), p('child', 'male')], ['外甥'], [], 140),
    rule('husbands-sisters-daughter', [p('spouse', 'male'), p('sibling', 'female'), p('child', 'female')], ['外甥女'], [], 140),

    rule('brothers-son', [p('sibling', 'male'), p('child', 'male')], ['侄子'], [], 125),
    rule('brothers-daughter', [p('sibling', 'male'), p('child', 'female')], ['侄女'], [], 125),
    rule('sisters-son', [p('sibling', 'female'), p('child', 'male')], ['外甥'], [], 125),
    rule('sisters-daughter', [p('sibling', 'female'), p('child', 'female')], ['外甥女'], [], 125),

    rule('brothers-sons-son', [p('sibling', 'male'), p('child', 'male'), p('child', 'male')], ['侄孙'], [], 140),
    rule('brothers-sons-daughter', [p('sibling', 'male'), p('child', 'male'), p('child', 'female')], ['侄孙女'], [], 140),
    rule('brothers-daughters-son', [p('sibling', 'male'), p('child', 'female'), p('child', 'male')], ['侄外孙'], [], 140),
    rule('brothers-daughters-daughter', [p('sibling', 'male'), p('child', 'female'), p('child', 'female')], ['侄外孙女'], [], 140),
    rule('sisters-sons-son', [p('sibling', 'female'), p('child', 'male'), p('child', 'male')], ['外甥孙'], [], 140),
    rule('sisters-sons-daughter', [p('sibling', 'female'), p('child', 'male'), p('child', 'female')], ['外甥孙女'], [], 140),
    rule('sisters-daughters-son', [p('sibling', 'female'), p('child', 'female'), p('child', 'male')], ['外甥外孙'], [], 140),
    rule('sisters-daughters-daughter', [p('sibling', 'female'), p('child', 'female'), p('child', 'female')], ['外甥外孙女'], [], 140),
    rule('brothers-sons-wife', [p('sibling', 'male'), p('child', 'male'), p('spouse', 'female')], ['侄媳', '侄媳妇'], [], 140),
    rule('brothers-daughters-husband', [p('sibling', 'male'), p('child', 'female'), p('spouse', 'male')], ['侄女婿'], [], 140),
    rule('sisters-sons-wife', [p('sibling', 'female'), p('child', 'male'), p('spouse', 'female')], ['外甥媳妇'], [], 140),
    rule('sisters-daughters-husband', [p('sibling', 'female'), p('child', 'female'), p('spouse', 'male')], ['外甥女婿'], [], 140),

    rule(
      'paternal-male-branch-female-cousins-son',
      [p('parent', 'male'), p('sibling', 'male'), p('child', 'female'), p('child', 'male')],
      ['堂外甥'],
      [],
      170,
    ),
    rule(
      'paternal-male-branch-female-cousins-daughter',
      [p('parent', 'male'), p('sibling', 'male'), p('child', 'female'), p('child', 'female')],
      ['堂外甥女'],
      [],
      170,
    ),
    rule(
      'paternal-male-branch-male-cousins-son',
      [p('parent', 'male'), p('sibling', 'male'), p('child', 'male'), p('child', 'male')],
      ['堂侄'],
      [],
      170,
    ),
    rule(
      'paternal-male-branch-male-cousins-daughter',
      [p('parent', 'male'), p('sibling', 'male'), p('child', 'male'), p('child', 'female')],
      ['堂侄女'],
      [],
      170,
    ),

    ...peerRules('paternal-male-branch', [p('parent', 'male'), p('sibling', 'male')], '堂', 150),
    ...peerRules('paternal-female-branch', [p('parent', 'male'), p('sibling', 'female')], '表', 150),
    ...peerRules('maternal-branch', [p('parent', 'female'), p('sibling')], '表', 150),

    specialAmbiguousParentSpouse('fathers-wife', 'male', 'female', '父亲的妻子', ['母亲', '继母'], '她是否是你的母亲', 145),
    specialAmbiguousParentSpouse('mothers-husband', 'female', 'male', '母亲的丈夫', ['父亲', '继父'], '他是否是你的父亲', 145),
    ambiguousRule('paternal-grandfathers-wife', [p('parent', 'male'), p('parent', 'male'), p('spouse', 'female')], '祖父的妻子', ['祖母', '继祖母'], '她是否是你的祖母', 145),
    ambiguousRule('paternal-grandmothers-husband', [p('parent', 'male'), p('parent', 'female'), p('spouse', 'male')], '祖母的丈夫', ['祖父', '继祖父'], '他是否是你的祖父', 145),
    ambiguousRule('maternal-grandfathers-wife', [p('parent', 'female'), p('parent', 'male'), p('spouse', 'female')], '外祖父的妻子', ['外祖母', '继外祖母'], '她是否是你的外祖母', 145),
    ambiguousRule('maternal-grandmothers-husband', [p('parent', 'female'), p('parent', 'female'), p('spouse', 'male')], '外祖母的丈夫', ['外祖父', '继外祖父'], '他是否是你的外祖父', 145),
  ];

  function p(relation, gender, seniority) {
    return {
      relation,
      ...(gender ? { gender } : {}),
      ...(seniority ? { seniority } : {}),
    };
  }

  function rule(id, pattern, reference, address, priority, when) {
    return {
      id,
      pattern,
      ...(when ? { when } : {}),
      output: {
        status: 'exact',
        reference: reference.map((x, i) => ({ ...term(x, i === 0 ? 'formal' : 'neutral'), preferred: i === 0 })),
        address: address.map((x, i) => ({ ...term(x, 'colloquial'), preferred: i === 0 })),
      },
      priority,
    };
  }

  function ambiguousRule(id, pattern, generic, candidates, missingFact, priority, when) {
    return {
      id,
      pattern,
      ...(when ? { when } : {}),
      output: {
        status: 'ambiguous',
        reference: [{ ...term(generic), preferred: true }],
        address: [],
        candidates,
        missingFacts: [missingFact],
        needsTargetAge: when?.targetRelativeAge === 'unknown',
      },
      priority,
    };
  }

  function specialAmbiguousParentSpouse(id, parentGender, spouseGender, generic, candidates, missingFact, priority) {
    return ambiguousRule(
      id,
      [p('parent', parentGender), p('spouse', spouseGender)],
      generic,
      candidates,
      missingFact,
      priority,
    );
  }

  function peerRules(idPrefix, prefix, familyMarker, priority) {
    const rows = [
      ['male', 'older', `${familyMarker}兄`, `${familyMarker}哥`],
      ['male', 'younger', `${familyMarker}弟`, `${familyMarker}弟`],
      ['female', 'older', `${familyMarker}姐`, `${familyMarker}姐`],
      ['female', 'younger', `${familyMarker}妹`, `${familyMarker}妹`],
    ];
    const generated = rows.map(([gender, age, value, spoken]) =>
      rule(
        `${idPrefix}-${gender}-${age}`,
        [...prefix, p('child', gender)],
        [value],
        [spoken],
        priority + 10,
        { targetRelativeAge: age },
      ),
    );
    generated.push(
      rule(
        `${idPrefix}-male-same`,
        [...prefix, p('child', 'male')],
        [`${familyMarker}兄弟`],
        [`${familyMarker}兄弟`],
        priority + 5,
        { targetRelativeAge: 'same' },
      ),
      rule(
        `${idPrefix}-female-same`,
        [...prefix, p('child', 'female')],
        [`${familyMarker}姐妹`],
        [`${familyMarker}姐妹`],
        priority + 5,
        { targetRelativeAge: 'same' },
      ),
      ambiguousRule(
        `${idPrefix}-male-unknown`,
        [...prefix, p('child', 'male')],
        `${familyMarker}兄弟`,
        [`${familyMarker}兄`, `${familyMarker}弟`],
        '他与你的长幼关系',
        priority,
        { targetRelativeAge: 'unknown' },
      ),
      ambiguousRule(
        `${idPrefix}-female-unknown`,
        [...prefix, p('child', 'female')],
        `${familyMarker}姐妹`,
        [`${familyMarker}姐`, `${familyMarker}妹`],
        '她与你的长幼关系',
        priority,
        { targetRelativeAge: 'unknown' },
      ),
    );
    return generated;
  }

  function tokenize(input) {
    if (Array.isArray(input)) return input.map(String).map((x) => x.trim()).filter(Boolean);
    if (typeof input !== 'string') throw new KinshipError('INVALID_PATH', '路径必须是字符串或字符串数组。');
    return input
      .split(/\s*(?:->|→|\/|,|，|>|的)\s*|\s+/u)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function expandAlias(value) {
    const alias = ALIASES[value.toLowerCase()] || ALIASES[value];
    if (!alias) return null;
    if (Array.isArray(alias)) return { tokens: alias, targetRelativeAge: null };
    if (alias && typeof alias === 'object') {
      return { tokens: alias.tokens, targetRelativeAge: alias.targetRelativeAge || null };
    }
    return { tokens: [alias], targetRelativeAge: null };
  }

  function parsePath(input) {
    const raw = tokenize(input);
    const hadTokens = raw.length > 0;
    const meaningful = raw.filter((value) => !EGO_TOKENS.has(value.toLowerCase()) && !EGO_TOKENS.has(value));
    if (!meaningful.length) {
      if (hadTokens) return { steps: [], impliedAge: null };
      throw new KinshipError('EMPTY_PATH', '请至少输入一步亲属关系。');
    }
    let impliedAge = null;
    const normalized = meaningful.flatMap((value, index) => {
      const alias = expandAlias(value);
      if (!alias) {
        throw new KinshipError('UNKNOWN_ATOM', `无法识别第 ${index + 1} 步“${value}”。`, { value, index });
      }
      if (meaningful.length === 1 && alias.targetRelativeAge) impliedAge = alias.targetRelativeAge;
      return alias.tokens.map((token) => ({ token, ...ATOMS[token] }));
    });
    if (normalized.length > MAX_INPUT_STEPS) {
      throw new KinshipError('PATH_TOO_LONG', `别名展开后的关系路径最多支持 ${MAX_INPUT_STEPS} 步。`, {
        rawLength: raw.length,
        normalizedLength: normalized.length,
      });
    }
    return { steps: normalized, impliedAge };
  }

  function normalizePath(input) {
    return parsePath(input).steps;
  }

  // Rewrites are deliberately length-decreasing. That gives the normalizer a
  // mechanical termination guarantee instead of relying on a fragile sequence
  // of hand-written while loops. A rule can return several alternatives when
  // the relationship itself is ambiguous (for example, father's son).
  const PATH_REWRITE_RULES = [
    {
      id: 'shared-parent-through-child-siblings',
      priority: 500,
      match(steps, start) {
        if (steps[start]?.relation !== 'parent' || steps[start + 1]?.relation !== 'child') return null;
        let end = start + 2;
        while (steps[end]?.relation === 'sibling') end += 1;
        if (steps[end]?.relation !== 'parent') return null;
        const replacement = [{ ...steps[end] }];
        return {
          deleteCount: end - start + 1,
          alternatives: [{
            replacement,
            assumption: `按“同胞兄弟姐妹共享同一对父母”的简化模式，将 ${steps.slice(start, end + 1).map((step) => step.label).join(' → ')} 归一为 ${replacement[0].label}。`,
          }],
        };
      },
    },
    {
      id: 'sibling-shares-parent',
      priority: 450,
      match(steps, start) {
        if (steps[start]?.relation !== 'sibling' || steps[start + 1]?.relation !== 'parent') return null;
        const replacement = [{ ...steps[start + 1] }];
        return {
          deleteCount: 2,
          alternatives: [{
            replacement,
            assumption: `按“同胞兄弟姐妹共享父母”的简化模式，将 ${steps.slice(start, start + 2).map((step) => step.label).join(' → ')} 归一为 ${replacement[0].label}。`,
          }],
        };
      },
    },
    {
      id: 'child-sibling-is-child',
      priority: 450,
      match(steps, start) {
        if (steps[start]?.relation !== 'child' || steps[start + 1]?.relation !== 'sibling') return null;
        const replacement = [makeStep('child', steps[start + 1].gender)];
        return {
          deleteCount: 2,
          alternatives: [{
            replacement,
            assumption: `按“子女之间为同胞兄弟姐妹”的简化模式，将 ${steps.slice(start, start + 2).map((step) => step.label).join(' → ')} 归一为 ${replacement[0].label}。`,
          }],
        };
      },
    },
    {
      id: 'spouse-round-trip',
      priority: 425,
      match(steps, start) {
        const first = steps[start];
        const second = steps[start + 1];
        if (first?.relation !== 'spouse' || second?.relation !== 'spouse' || first.gender === second.gender) return null;
        return {
          deleteCount: 2,
          alternatives: [{
            replacement: [],
            assumption: `按“一夫一妻且路径中的配偶互为配偶”的简化模式，将 ${first.label} → ${second.label} 归一为当前人物。`,
          }],
        };
      },
    },
    {
      id: 'child-parent-is-ego-or-spouse',
      priority: 400,
      match(steps, start, context) {
        const child = steps[start];
        const parent = steps[start + 1];
        if (child?.relation !== 'child' || parent?.relation !== 'parent') return null;
        const sourceGender = sourceGenderAt(steps, start, context);
        const base = `按“该子女由当前人物及其配偶共同生育”的简化模式，${child.label}的${parent.label}`;
        if (sourceGender === 'unknown') {
          return {
            deleteCount: 2,
            alternatives: [
              { replacement: [], assumption: `${base}可能是当前人物。`, missingFact: '需要当前人物性别才能判断子女的这位父母是当前人物还是其配偶。' },
              { replacement: [makeStep('spouse', parent.gender)], assumption: `${base}也可能是当前人物的配偶。`, missingFact: '需要当前人物性别才能判断子女的这位父母是当前人物还是其配偶。' },
            ],
          };
        }
        const isSourcePerson = sourceGender === parent.gender;
        return {
          deleteCount: 2,
          alternatives: [{
            replacement: isSourcePerson ? [] : [makeStep('spouse', parent.gender)],
            assumption: `${base}归一为${isSourcePerson ? '当前人物' : parent.gender === 'male' ? '其丈夫' : '其妻子'}。`,
          }],
        };
      },
    },
    {
      id: 'sibling-of-sibling',
      priority: 380,
      match(steps, start, context) {
        const first = steps[start];
        const second = steps[start + 1];
        if (first?.relation !== 'sibling' || second?.relation !== 'sibling') return null;
        const sourceGender = sourceGenderAt(steps, start, context);
        const firstSen = first.seniority || 'unknown';
        const secondSen = second.seniority || 'unknown';
        const cannotBeSelf = (firstSen === 'older' && secondSen === 'older')
          || (firstSen === 'younger' && secondSen === 'younger');
        const genderAllowsSelf = sourceGender === 'unknown' || sourceGender === second.gender;
        const ageExcludesSelf = context.targetRelativeAge === 'older' || context.targetRelativeAge === 'younger';
        const alternatives = [];
        const identityMissingFact = '需要确认这位同胞的同胞是当前人物还是另一位同胞。';
        if (genderAllowsSelf && !cannotBeSelf && !ageExcludesSelf) {
          alternatives.push({
            replacement: [],
            assumption: `按“同胞共享同一组兄弟姐妹”的简化模式，${first.label}的${second.label}可能是当前人物。`,
            missingFact: identityMissingFact,
          });
        }
        let resultSeniority = 'unknown';
        if (firstSen === 'older' && secondSen === 'older') resultSeniority = 'older';
        else if (firstSen === 'younger' && secondSen === 'younger') resultSeniority = 'younger';
        else if (context.targetRelativeAge === 'older' || context.targetRelativeAge === 'younger') {
          resultSeniority = context.targetRelativeAge;
        }
        alternatives.push({
          replacement: [makeStep('sibling', second.gender, resultSeniority)],
          assumption: `按“同胞共享同一组兄弟姐妹”的简化模式，${first.label}的${second.label}归一为另一位${second.gender === 'male' ? '兄弟' : '姐妹'}。`,
          missingFact: resultSeniority === 'unknown'
            ? '需要确认这位同胞与当前人物的长幼关系。'
            : undefined,
        });
        return { deleteCount: 2, alternatives };
      },
    },
    {
      id: 'spouse-child-is-shared-child',
      priority: 350,
      match(steps, start) {
        const spouse = steps[start];
        const child = steps[start + 1];
        if (spouse?.relation !== 'spouse' || child?.relation !== 'child') return null;
        const replacement = [{ ...child }];
        return {
          deleteCount: 2,
          alternatives: [{
            replacement,
            assumption: `按“配偶的该子女也是己身子女”的简化模式，将 ${spouse.label} → ${child.label} 归一为 ${child.label}。`,
          }],
        };
      },
    },
    {
      id: 'parent-child-is-ego-or-sibling',
      priority: 200,
      match(steps, start, context) {
        const parent = steps[start];
        const child = steps[start + 1];
        if (parent?.relation !== 'parent' || child?.relation !== 'child') return null;
        const sourceGender = sourceGenderAt(steps, start, context);
        const alternatives = [];
        const identityMissingFact = '需要确认父母的这位子女是当前人物还是当前人物的同胞，并在同胞情形下确认长幼。';
        const seniorityMissingFact = '需要确认这位同胞与当前人物的长幼关系。';
        const ageExcludesSelf = context.targetRelativeAge === 'older' || context.targetRelativeAge === 'younger';
        if ((sourceGender === 'unknown' || sourceGender === child.gender) && !ageExcludesSelf) {
          alternatives.push({ replacement: [], missingFact: identityMissingFact });
        }
        const siblingSeniority = (context.targetRelativeAge === 'older' || context.targetRelativeAge === 'younger')
          ? context.targetRelativeAge
          : 'unknown';
        alternatives.push({
          replacement: [makeStep('sibling', child.gender, siblingSeniority)],
          missingFact: sourceGender !== 'unknown' && sourceGender !== child.gender
            ? seniorityMissingFact
            : (siblingSeniority === 'unknown' ? identityMissingFact : seniorityMissingFact),
        });
        return { deleteCount: 2, alternatives };
      },
    },
  ];

  function pathSignature(steps) {
    return steps.map((step) => [step.relation, step.gender || 'unknown', step.seniority || ''].join(':')).join('|');
  }

  function sourceGenderAt(steps, start, context) {
    if (start === 0) return context.egoGender;
    return steps[start - 1]?.gender || 'unknown';
  }

  function findPreferredRewrites(steps, context) {
    const matches = [];
    PATH_REWRITE_RULES.forEach((rewrite) => {
      for (let start = 0; start < steps.length; start += 1) {
        // targetRelativeAge compares the final person with the original ego.
        // Only a rewrite spanning that entire pair may use it. Applying it to
        // an inner pair confuses, for example, an uncle's age with a cousin's.
        const localContext = start === 0 && steps.length === 2
          ? context : { ...context, targetRelativeAge: 'unknown' };
        const match = rewrite.match(steps, start, localContext);
        if (match) matches.push({ ...match, id: rewrite.id, priority: rewrite.priority, start });
      }
    });
    matches.sort((a, b) => b.priority - a.priority || a.start - b.start || b.deleteCount - a.deleteCount || a.id.localeCompare(b.id));
    if (!matches.length) return [];
    const highestPriority = matches[0].priority;
    // Explore every redex at the winning priority. Independent rewrites should
    // converge; overlapping ones that do not converge remain visible as
    // separate terminal candidates instead of depending on loop order.
    return matches.filter((match) => match.priority === highestPriority);
  }

  function canonicalizePathCandidates(inputSteps, ctx) {
    const context = typeof ctx === 'string' ? normalizeContext({ familyAssumption: ctx }) : normalizeContext(ctx);
    const initialSteps = inputSteps.map((step) => ({ ...step }));
    if (context.familyAssumption === 'strict-explicit') {
      return {
        candidates: [{ steps: initialSteps, assumptions: [], missingFacts: [], rewriteTrace: [] }],
        reachedFixedPoint: true,
        exploredStates: 1,
      };
    }

    const queue = [{ steps: initialSteps, assumptions: [], missingFacts: [], rewriteTrace: [] }];
    // Breadth-first traversal reaches each signature by a shortest trace first.
    // Deduplicate before enqueueing so alternate rewrite orders do not consume
    // the state budget or fill the queue with the same relationship.
    const seen = new Set([pathSignature(initialSteps)]);
    const terminal = new Map();
    let exploredStates = 0;

    while (queue.length) {
      const state = queue.shift();
      exploredStates += 1;
      if (exploredStates > MAX_REWRITE_STATES) {
        throw new KinshipError('REWRITE_STATE_LIMIT', `关系化简产生的候选状态超过 ${MAX_REWRITE_STATES} 个。`, {
          input: pathSignature(initialSteps),
        });
      }

      const signature = pathSignature(state.steps);
      const rewrites = findPreferredRewrites(state.steps, context);
      if (!rewrites.length) {
        const current = terminal.get(signature);
        if (!current || state.rewriteTrace.length < current.rewriteTrace.length) terminal.set(signature, state);
        continue;
      }

      rewrites.forEach((rewrite) => {
        rewrite.alternatives.forEach((alternative) => {
          const replacement = (alternative.replacement || []).map((step) => ({ ...step }));
          const nextSteps = [
            ...state.steps.slice(0, rewrite.start).map((step) => ({ ...step })),
            ...replacement,
            ...state.steps.slice(rewrite.start + rewrite.deleteCount).map((step) => ({ ...step })),
          ];
          if (nextSteps.length >= state.steps.length) {
            throw new KinshipError('NON_REDUCING_REWRITE', `化简规则 ${rewrite.id} 没有缩短关系链。`, { ruleId: rewrite.id });
          }
          const nextSignature = pathSignature(nextSteps);
          if (seen.has(nextSignature)) return;
          seen.add(nextSignature);
          const before = state.steps.slice(rewrite.start, rewrite.start + rewrite.deleteCount);
          queue.push({
            steps: nextSteps,
            assumptions: alternative.assumption
              ? [...new Set([...state.assumptions, alternative.assumption])]
              : [...state.assumptions],
            missingFacts: alternative.missingFact
              ? [...new Set([...state.missingFacts, alternative.missingFact])]
              : [...state.missingFacts],
            rewriteTrace: [...state.rewriteTrace, {
              ruleId: rewrite.id,
              start: rewrite.start,
              before: before.map((step) => step.token || step.label),
              after: replacement.map((step) => step.token || step.label),
            }],
          });
        });
      });
    }

    const candidates = [...terminal.values()].filter(candidate => {
      const age = context.targetRelativeAge;
      if (age !== 'older' && age !== 'younger') return true;
      // Different reduction orders can expose an already age-qualified sibling
      // or return to ego. Check the final endpoints before merging candidates.
      if (!candidate.steps.length) return false;
      const sibling = candidate.steps.length === 1 && candidate.steps[0];
      return !sibling || sibling.relation !== 'sibling'
        || !['older', 'younger'].includes(sibling.seniority) || sibling.seniority === age;
    }).sort((a, b) =>
      a.steps.length - b.steps.length || pathSignature(a.steps).localeCompare(pathSignature(b.steps)),
    );
    if (!candidates.length) {
      throw new KinshipError('INCONSISTENT_AGE', '长幼信息与这段关系不一致。');
    }
    return { candidates, reachedFixedPoint: true, exploredStates };
  }

  function simplifyPath(inputSteps, familyAssumption) {
    const normalized = canonicalizePathCandidates(inputSteps, familyAssumption);
    const primary = normalized.candidates[0];
    return {
      steps: primary.steps,
      assumptions: primary.assumptions,
      missingFacts: primary.missingFacts,
      rewriteTrace: primary.rewriteTrace,
      alternatives: normalized.candidates.slice(1),
      reachedFixedPoint: normalized.reachedFixedPoint,
      exploredStates: normalized.exploredStates,
    };
  }

  function normalizeContext(ctx) {
    const input = ctx || {};
    const egoGender = GENDERS.includes(input.egoGender) ? input.egoGender : 'unknown';
    const targetRelativeAge = RELATIVE_AGES.includes(input.targetRelativeAge)
      ? input.targetRelativeAge
      : 'unknown';
    return {
      egoGender,
      targetRelativeAge,
      locale: input.locale || 'zh-Hans-CN',
      mode: input.mode === 'address' ? 'address' : 'reference',
      familyAssumption: input.familyAssumption === 'strict-explicit' ? 'strict-explicit' : 'traditional-simple',
    };
  }

  function matchPattern(pattern, steps) {
    if (pattern.length !== steps.length) return false;
    return pattern.every((expected, index) => {
      const actual = steps[index];
      return Object.keys(expected).every((key) => expected[key] === actual[key]);
    });
  }

  function matchesWhen(when, ctx) {
    if (!when) return true;
    return Object.entries(when).every(([key, value]) => ctx[key] === value);
  }

  function findRule(steps, ctx) {
    return rules
      .filter((candidate) => matchPattern(candidate.pattern, steps) && matchesWhen(candidate.when, ctx))
      .sort((a, b) => b.priority - a.priority || specificity(b) - specificity(a))[0];
  }

  function deriveKinshipRole(steps) {
    let cursor = 0;
    const frame = steps[0] && steps[0].relation === 'spouse'
      ? { origin: 'spouse-family', spouseGender: steps[cursor++].gender }
      : { origin: 'ego' };

    const ancestorPath = [];
    while (cursor < steps.length && steps[cursor].relation === 'parent') {
      ancestorPath.push(steps[cursor].gender);
      cursor += 1;
    }

    let branch = null;
    if (cursor < steps.length && steps[cursor].relation === 'sibling') {
      branch = {
        gender: steps[cursor].gender,
        seniority: steps[cursor].seniority || 'unknown',
      };
      cursor += 1;
    }

    // A collateral relative can lead through a spouse into another collateral
    // branch, e.g. 母亲 -> 姐姐 -> 丈夫 -> 妹妹. Preserve this bridge as
    // structured role data instead of leaving the whole path unclassified.
    let affinalBridge = null;
    if (
      branch &&
      steps[cursor]?.relation === 'spouse' &&
      steps[cursor + 1]?.relation === 'sibling'
    ) {
      affinalBridge = {
        spouseGender: steps[cursor].gender,
        branch: {
          gender: steps[cursor + 1].gender,
          seniority: steps[cursor + 1].seniority || 'unknown',
        },
      };
      cursor += 2;
    }

    const descendantPath = [];
    while (cursor < steps.length && steps[cursor].relation === 'child') {
      descendantPath.push(steps[cursor].gender);
      cursor += 1;
    }

    let endpointSpouse = null;
    if (cursor < steps.length && steps[cursor].relation === 'spouse' && cursor === steps.length - 1) {
      endpointSpouse = { gender: steps[cursor].gender };
      cursor += 1;
    }

    let kind = steps.length === 0 ? 'self' : 'unclassified';
    if (cursor === steps.length) {
      if (branch) kind = 'collateral';
      else if (ancestorPath.length > 0 && descendantPath.length === 0) kind = 'lineal-ancestor';
      else if (ancestorPath.length === 0 && descendantPath.length > 0) kind = 'lineal-descendant';
      else if (ancestorPath.length === 0 && descendantPath.length === 0 && frame.origin === 'spouse-family') kind = 'frame-person';
    }

    const frameKey = frame.origin === 'ego' ? 'ego' : `spouse:${frame.spouseGender}`;
    const signatureParts = [`role:${kind}`, `frame:${frameKey}`];
    if (ancestorPath.length) signatureParts.push(`ancestors:${ancestorPath.join('-')}`);
    if (branch) signatureParts.push(`branch:${branch.gender}:${branch.seniority}`);
    if (affinalBridge) {
      signatureParts.push(`affinal-bridge:spouse:${affinalBridge.spouseGender}`);
      signatureParts.push(`affinal-branch:${affinalBridge.branch.gender}:${affinalBridge.branch.seniority}`);
    }
    if (descendantPath.length) signatureParts.push(`descendants:${descendantPath.join('-')}`);
    if (endpointSpouse) signatureParts.push(`endpoint-spouse:${endpointSpouse.gender}`);

    return {
      kind,
      frame,
      ancestorPath,
      branch,
      affinalBridge,
      descendantPath,
      endpointSpouse,
      consumedSteps: cursor,
      signature: signatureParts.join('|'),
    };
  }

  // Backward-compatible API name. The returned value is now a unified role,
  // rather than one of several unrelated ad-hoc structure objects.
  function classifyStructure(steps) {
    return deriveKinshipRole(steps);
  }

  function findRoleTerm(role, ctx) {
    if (!role || role.kind === 'unclassified') return null;
    const localePack = STRUCTURAL_TERM_PACKS[ctx.locale] || STRUCTURAL_TERM_PACKS['zh-Hans-CN'];

    if (role.kind === 'lineal-ancestor' && role.frame.origin === 'ego') {
      const roleKey = role.ancestorPath.join('-');
      const terms = localePack.linealAncestor[roleKey];
      if (!terms) return null;
      return materializeStructuralTerm(`role.lineal-ancestor.${roleKey}`, terms);
    }

    if (role.kind === 'lineal-descendant' && role.frame.origin === 'ego') {
      const endpointKey = role.endpointSpouse ? `spouse:${role.endpointSpouse.gender}` : 'self';
      const roleKey = `${role.descendantPath.join('-')}:${endpointKey}`;
      const exactTerms = localePack.linealDescendant[roleKey];
      if (exactTerms) return materializeStructuralTerm(`role.lineal-descendant.${roleKey}`, exactTerms);

      const descendantDepth = role.descendantPath.length;
      const generation = localePack.descendantGenerations[descendantDepth];
      const targetGender = role.descendantPath[descendantDepth - 1];
      if (!generation || !['male', 'female'].includes(targetGender)) return null;

      const throughFemale = role.descendantPath.slice(0, -1).some((gender) => gender === 'female');
      let baseTerm = generation[targetGender];
      if (throughFemale && !String(baseTerm).startsWith('外')) baseTerm = `外${baseTerm}`;

      let renderedTerm = baseTerm;
      if (role.endpointSpouse) {
        const spouseGender = role.endpointSpouse.gender;
        if (targetGender === 'male' && spouseGender === 'female') renderedTerm = `${baseTerm}媳妇`;
        else if (targetGender === 'female' && spouseGender === 'male') renderedTerm = `${baseTerm}婿`;
        else return null;
      }

      return materializeStructuralTerm(
        `role.lineal-descendant-generation.${descendantDepth}.${targetGender}.${endpointKey}${throughFemale ? '.wai' : ''}`,
        { reference: [renderedTerm], address: [] },
        {
          descendantGeneration: descendantDepth,
          baseTerm,
          usage: generation.usage,
          lineageScope: throughFemale ? 'through-female' : 'patrilineal-chain',
        },
      );
    }

    if (role.kind !== 'collateral' || !role.branch) return null;
    const endpointKey = role.endpointSpouse ? `spouse:${role.endpointSpouse.gender}` : 'self';

    if (
      role.affinalBridge &&
      role.frame.origin === 'ego' &&
      role.descendantPath.length === 1 &&
      !role.endpointSpouse
    ) {
      const bridgeKey = [
        role.ancestorPath.join('-'),
        role.branch.gender,
        role.affinalBridge.spouseGender,
        role.affinalBridge.branch.gender,
      ].join(':');
      const bridgeFamily = localePack.affinalPeerBranches[bridgeKey];
      if (bridgeFamily) {
        const targetGender = role.descendantPath[0];
        return materializePeerRoleTerm(
          `role.affinal-peer.${bridgeFamily.id}.${targetGender}.${ctx.targetRelativeAge}`,
          bridgeFamily.prefix,
          targetGender,
          ctx.targetRelativeAge,
        );
      }
    }

    if (
      role.frame.origin === 'ego' &&
      role.ancestorPath.join(',') === 'male,male' &&
      role.descendantPath.length === 0
    ) {
      const roleKey = `${role.branch.gender}:${role.branch.seniority}:${endpointKey}`;
      const terms = localePack.paternalGrandfatherCollateral[roleKey];
      if (terms) return materializeStructuralTerm(`role.paternal-grandfather-collateral.${roleKey}`, terms);
    }

    if (
      role.frame.origin === 'ego' &&
      role.ancestorPath.length === 2 &&
      role.descendantPath.length === 0
    ) {
      const gpKey = `${role.ancestorPath.join('-')}:${role.branch.gender}:${role.branch.seniority}:${endpointKey}`;
      const gpUnknownKey = `${role.ancestorPath.join('-')}:${role.branch.gender}:unknown:${endpointKey}`;
      const gpTerms = localePack.grandparentCollateral[gpKey] || localePack.grandparentCollateral[gpUnknownKey];
      if (gpTerms) return materializeStructuralTerm(`role.grandparent-collateral.${gpKey}`, gpTerms);
    }

    if (
      role.frame.origin === 'ego' &&
      role.ancestorPath.length === 2 &&
      role.descendantPath.length === 1 &&
      !role.affinalBridge
    ) {
      const cousinKey = `${role.ancestorPath.join('-')}:${role.branch.gender}:${role.descendantPath[0]}:${endpointKey}`;
      const terms = localePack.parentCousin[cousinKey];
      if (terms && terms.older) {
        return materializeStructuralAmbiguity(
          `role.parent-cousin.${cousinKey}`,
          terms.generic,
          [terms.older.reference[0], terms.younger.reference[0]],
          '他与你父亲的长幼关系',
        );
      }
      if (terms) return materializeStructuralTerm(`role.parent-cousin.${cousinKey}`, terms);
    }

    // Extended peer branches share one renderer. The locale data determines
    // whether the structural route is 堂姑表、堂舅表、堂姨表, while this
    // code consistently applies endpoint gender and relative seniority.
    if (
      role.frame.origin === 'ego' &&
      role.descendantPath.length === 2 &&
      !role.endpointSpouse
    ) {
      const branchKey = `${role.ancestorPath.join('-')}:${role.branch.gender}:${role.descendantPath[0]}`;
      const branchFamily = localePack.extendedPeerBranches[branchKey];
      if (branchFamily) {
        const targetGender = role.descendantPath[1];
        return materializePeerRoleTerm(
          `role.extended-peer.${branchFamily.id}.${targetGender}.${ctx.targetRelativeAge}`,
          branchFamily.prefix,
          targetGender,
          ctx.targetRelativeAge,
          branchFamily.spoken,
        );
      }
    }

    if (
      role.frame.origin === 'ego' &&
      role.descendantPath.length === 2 &&
      !role.endpointSpouse
    ) {
      const descendantKey = `${role.ancestorPath.join('-')}:${role.branch.gender}:${role.descendantPath[0]}`;
      const descendantFamily = localePack.collateralDescendantBranches[descendantKey];
      if (descendantFamily) {
        return materializeCollateralDescendantTerm(
          `role.collateral-descendant.${descendantFamily.id}.${role.descendantPath[1]}`,
          descendantFamily,
          role.descendantPath[1],
        );
      }
    }

    if (role.frame.origin === 'spouse-family' && role.ancestorPath.length === 0) {
      if (role.descendantPath.length === 0 && !role.endpointSpouse) {
        // This sibling's seniority is relative to the spouse, not the ego.
        const seniority = role.branch.seniority || 'unknown';
        const roleKey = `${role.frame.spouseGender}:${role.branch.gender}:${seniority}`;
        const terms = localePack.spouseImmediateCollateral[roleKey];
        if (terms) return materializeStructuralTerm(`role.spouse-immediate-collateral.${roleKey}`, terms);
        if (seniority === 'unknown') {
          const olderKey = `${role.frame.spouseGender}:${role.branch.gender}:older`;
          const youngerKey = `${role.frame.spouseGender}:${role.branch.gender}:younger`;
          const older = localePack.spouseImmediateCollateral[olderKey];
          const younger = localePack.spouseImmediateCollateral[youngerKey];
          if (older && younger) {
            const spouseLabel = role.frame.spouseGender === 'female' ? '妻子' : '丈夫';
            const siblingLabel = role.branch.gender === 'male' ? '兄弟' : '姐妹';
            return materializeStructuralAmbiguity(
              `role.spouse-immediate-collateral.${roleKey}`,
              `${spouseLabel}的${siblingLabel}`,
              [older.reference[0], younger.reference[0]],
              '需要确认该亲属与配偶的长幼关系。',
            );
          }
        }
        return null;
      }

      if (role.descendantPath.length === 1) {
        const exactKey = [
          role.frame.spouseGender,
          role.branch.gender,
          role.branch.seniority,
          role.descendantPath[0],
          endpointKey,
        ].join(':');
        const wildcardKey = [
          role.frame.spouseGender,
          role.branch.gender,
          '*',
          role.descendantPath[0],
          endpointKey,
        ].join(':');
        const terms = localePack.spouseCollateralDescendant[exactKey] ||
          localePack.spouseCollateralDescendant[wildcardKey];
        if (!terms) return null;
        return materializeStructuralTerm(`role.spouse-collateral-descendant.${exactKey}`, terms);
      }
    }

    return null;
  }

  // 父亲的妻子 may be one's mother or a stepmother (see fathers-wife). Carry
  // that ambiguity forward: 父亲的妻子的父亲 is 外公 or 继母的父亲.
  function findStepParentTerm(steps, ctx) {
    const [parent, spouse, ...rest] = steps;
    if (steps.length < 3 || parent.relation !== 'parent' || spouse.relation !== 'spouse' || parent.gender === spouse.gender) return null;
    const innerSteps = [makeStep('parent', spouse.gender), ...rest];
    const inner = findRule(innerSteps, ctx) || findRoleTerm(deriveKinshipRole(innerSteps), ctx);
    if (!inner || !['exact', 'ambiguous'].includes(inner.output.status)) return null;
    const own = inner.output.status === 'ambiguous' ? inner.output.candidates : [inner.output.reference[0].value];
    const restLabel = rest.map((step) => step.label).join('的');
    return {
      id: `step-parent.${inner.id}`,
      output: {
        status: 'ambiguous',
        reference: [{ ...term(`${parent.label}的${spouse.label}的${restLabel}`), preferred: true }],
        address: [],
        candidates: [...own, `${spouse.gender === 'female' ? '继母' : '继父'}的${restLabel}`],
        missingFacts: [...(inner.output.missingFacts || []), spouse.gender === 'female' ? '她是否是你的母亲' : '他是否是你的父亲'],
        needsTargetAge: Boolean(inner.output.needsTargetAge),
      },
    };
  }

  // A relative of a relative's spouse (嫂子的哥哥) has no dedicated term. Name
  // them through that connecting relative, and suggest what to say: follow how
  // the connecting relative addresses them, adjusted for generation and age.
  function findBridgeRelativeTerm(steps, ctx) {
    for (let end = steps.length - 1; end >= 1; end -= 1) {
      if (steps[end - 1].relation !== 'spouse') continue;
      const bridgeSteps = steps.slice(0, end);
      const bridge = findRule(bridgeSteps, ctx) || findRoleTerm(deriveKinshipRole(bridgeSteps), ctx);
      if (!bridge || bridge.output.status !== 'exact') continue;
      const rest = steps.slice(end);
      const bridgeTerm = bridge.output.reference[0].value;
      const bridgeContext = { ...ctx, egoGender: steps[end - 1].gender, targetRelativeAge: 'unknown' };
      const fromBridge = findRule(rest, bridgeContext) || findRoleTerm(deriveKinshipRole(rest), bridgeContext);
      const bridgeAddress = fromBridge && fromBridge.output.status === 'exact'
        ? (fromBridge.output.address[0] || fromBridge.output.reference[0]).value
        : null;
      const generation = steps.reduce((sum, step) =>
        sum + (step.relation === 'parent' ? 1 : step.relation === 'child' ? -1 : 0), 0);
      const gender = steps[steps.length - 1].gender;
      const peer = { male: ['哥', '大哥'], female: ['姐', '大姐'] }[gender] || [];
      const elder = generation >= 2
        ? { male: ['爷爷'], female: ['奶奶'] }[gender]
        : { male: ['伯伯', '叔叔'], female: ['阿姨'] }[gender];
      let address = [];
      let spokenByName = false;
      let spokenIfOlder = null;
      if (generation > 0) address = elder || [];
      else if (generation < 0 || ['younger', 'same'].includes(ctx.targetRelativeAge)) spokenByName = true;
      else if (ctx.targetRelativeAge === 'older') address = peer;
      else spokenIfOlder = peer;
      return {
        id: `bridge-relative.${bridge.id}`,
        metadata: { bridge: bridgeTerm, bridgeAddress, generation, spokenByName, spokenIfOlder },
        output: {
          status: 'descriptive',
          reference: [{ ...term(`${bridgeTerm}的${rest.map((step) => step.label).join('的')}`), preferred: true }],
          address: address.map((value, index) => ({ ...term(value, 'colloquial'), preferred: index === 0 })),
          candidates: [],
          missingFacts: spokenIfOlder ? [gender === 'female' ? '她与你的长幼关系' : '他与你的长幼关系'] : [],
          needsTargetAge: Boolean(spokenIfOlder),
        },
      };
    }
    return null;
  }

  function findContextualAffinalTerm(steps, ctx) {
    if (steps.length < 2 || steps[0].relation !== 'spouse') return null;
    const innerSteps = steps.slice(1);
    const innerContext = { ...ctx, egoGender: steps[0].gender, targetRelativeAge: 'unknown' };
    const innerExact = findRule(innerSteps, innerContext);
    const innerRole = deriveKinshipRole(innerSteps);
    const innerRoleTerm = innerExact ? null : findRoleTerm(innerRole, innerContext);
    const innerMatch = innerExact || innerRoleTerm;
    if (!innerMatch) return null;

    const frameLabel = steps[0].gender === 'female' ? '妻子' : steps[0].gender === 'male' ? '丈夫' : '配偶';
    const innerTerm = innerMatch.output.reference[0].value;
    const innerCandidates = innerMatch.output.candidates || [];
    return {
      id: `contextual-affinal.${steps[0].gender}.${innerMatch.id}`,
      metadata: {
        frameOrigin: 'spouse-family',
        innerRoleSignature: innerRole.signature,
      },
      output: {
        status: innerMatch.output.status === 'ambiguous' ? 'ambiguous' : 'descriptive',
        reference: [{ ...term(`${frameLabel}的${innerTerm}`), preferred: true }],
        address: [],
        candidates: innerCandidates.map((value) => `${frameLabel}的${value}`),
        missingFacts: (innerMatch.output.missingFacts || []).map(fact => fact.replace(/与你/g, '与配偶')),
      },
    };
  }

  function materializeStructuralTerm(id, terms, metadata) {
    return {
      id,
      ...(metadata ? { metadata } : {}),
      output: {
        status: 'exact',
        reference: terms.reference.map((value, index) => ({ ...term(value, index === 0 ? 'neutral' : 'formal'), preferred: index === 0 })),
        address: terms.address.map((value, index) => ({ ...term(value, 'colloquial'), preferred: index === 0 })),
      },
    };
  }

  function materializeStructuralAmbiguity(id, generic, candidates, missingFact, needsTargetAge = false) {
    return {
      id,
      output: {
        status: 'ambiguous',
        reference: [{ ...term(generic), preferred: true }],
        address: [],
        candidates: uniqueStrings(candidates),
        missingFacts: [missingFact],
        needsTargetAge,
      },
    };
  }

  function materializePeerRoleTerm(id, prefix, gender, relativeAge, spokenPrefix = prefix) {
    const suffixes = gender === 'male'
      ? { older: ['哥', '兄'], younger: ['弟'], generic: '兄弟' }
      : gender === 'female'
        ? { older: ['姐', '姊'], younger: ['妹'], generic: '姐妹' }
        : null;
    if (!suffixes) return null;

    if (relativeAge === 'older' || relativeAge === 'younger') {
      const values = suffixes[relativeAge].map((suffix) => `${prefix}${suffix}`);
      return materializeStructuralTerm(id, {
        reference: values,
        address: [`${spokenPrefix}${suffixes[relativeAge][0]}`],
      }, {
        peerBranch: prefix,
        targetRelativeAge: relativeAge,
      });
    }

    if (relativeAge === 'same') {
      return materializeStructuralTerm(id, {
        reference: [`${prefix}${suffixes.generic}`],
        address: [],
      }, {
        peerBranch: prefix,
        targetRelativeAge: 'same',
      });
    }

    return materializeStructuralAmbiguity(
      id,
      `${prefix}${suffixes.generic}`,
      [`${prefix}${suffixes.older[0]}`, `${prefix}${suffixes.younger[0]}`],
      '需要确认该亲属与你的长幼关系。',
      true,
    );
  }

  function materializeCollateralDescendantTerm(id, family, targetGender) {
    if (!['male', 'female'].includes(targetGender)) return null;
    const genderSuffix = targetGender === 'male' ? '男' : '女';
    const formal = `${family.prefix}${family.relation}${genderSuffix}`;
    const colloquialBase = family.relation === '甥' ? '外甥' : '侄';
    const colloquial = `${family.prefix}${colloquialBase}${targetGender === 'male' ? '' : '女'}`;
    const preferColloquial = family.prefix === '堂' || family.prefix === '姑表' || family.prefix === '姨表';
    const reference = formal === colloquial
      ? [formal]
      : preferColloquial
        ? [colloquial, formal]
        : [formal, colloquial];
    return materializeStructuralTerm(id, {
      reference,
      address: [],
    }, {
      collateralBranch: family.prefix,
      descendantRelation: family.relation,
      targetGender,
    });
  }

  function specificity(candidate) {
    return candidate.pattern.reduce((sum, step) => sum + Object.keys(step).length, 0) + (candidate.when ? 2 : 0);
  }

  function lineageThroughFemale(role) {
    if (!role) return false;
    if (role.ancestorPath.some((gender) => gender === 'female')) return true;
    if (role.descendantPath.slice(0, -1).some((gender) => gender === 'female')) return true;
    const leftTheMaleLineThroughSister = role.branch
      && role.branch.gender === 'female'
      && (role.descendantPath.length > 0 || role.affinalBridge || role.endpointSpouse);
    if (leftTheMaleLineThroughSister) return true;
    if (role.affinalBridge && (role.affinalBridge.spouseGender === 'female' || role.affinalBridge.branch.gender === 'female')) {
      return true;
    }
    return false;
  }

  function calculateGenealogicalBoundary(input) {
    const role = input && input.role;
    const spouseLinks = input && Number.isFinite(input.spouseLinks) ? input.spouseLinks : 0;
    if (!role || role.kind === 'unclassified') {
      return {
        status: 'unknown',
        reason: '路径尚未归一为可计算的谱系角色。',
      };
    }

    if (spouseLinks > 0 || role.frame.origin === 'spouse-family' || role.endpointSpouse) {
      return {
        status: 'affinal',
        spouseLinks,
        withinFourGenerationRange: null,
        reason: '目标路径经过配偶边，不能作为直接血缘距离判定。',
      };
    }

    let egoDistance;
    let targetDistance;
    let basis;
    if (role.kind === 'self') {
      egoDistance = 0;
      targetDistance = 0;
      basis = 'self';
    } else if (role.kind === 'lineal-ancestor') {
      egoDistance = role.ancestorPath.length;
      targetDistance = 0;
      basis = 'direct-lineal-ancestor';
    } else if (role.kind === 'lineal-descendant') {
      egoDistance = 0;
      targetDistance = role.descendantPath.length;
      basis = 'direct-lineal-descendant';
    } else if (role.kind === 'collateral') {
      egoDistance = role.ancestorPath.length + 1;
      targetDistance = role.descendantPath.length + 1;
      basis = 'nearest-common-ancestor';
    } else {
      return {
        status: 'unknown',
        reason: '当前角色不包含可靠的直系或共同祖先坐标。',
      };
    }

    const throughFemaleLine = lineageThroughFemale(role);
    const maximumDistance = Math.max(egoDistance, targetDistance);
    return {
      status: 'calculated',
      basis,
      egoDistance,
      targetDistance,
      relationDistance: egoDistance + targetDistance,
      maximumDistance,
      withinFourGenerationRange: maximumDistance <= 4,
      throughFemaleLine,
      agnatic: !throughFemaleLine,
    };
  }

  function assessFiveFu(boundary) {
    if (!boundary || boundary.status === 'unknown') {
      return {
        status: 'insufficient',
        reason: '缺少可靠的谱系坐标，无法判定服制。',
      };
    }
    if (boundary.status === 'affinal') {
      return {
        status: 'not-applicable',
        reason: '姻亲路径不能仅凭血缘世代距离判定五服。',
      };
    }
    return {
      status: 'insufficient',
      boundaryHint: {
        withinFourGenerationRange: boundary.withinFourGenerationRange,
        egoDistance: boundary.egoDistance,
        targetDistance: boundary.targetDistance,
      },
      reason: '谱系距离只是边界指标；缺少父系/母系、经女性连接、婚姻状态和礼制依据时，不输出具体服等。',
    };
  }

  function extractSemantics(steps, context) {
    let generationDelta = 0;
    let spouseLinks = 0;
    let firstParentGender;
    let firstRelation;
    let siblingIndex = -1;

    steps.forEach((step, index) => {
      if (!firstRelation) firstRelation = step.relation;
      if (step.relation === 'parent') {
        generationDelta += 1;
        if (!firstParentGender) firstParentGender = step.gender;
      }
      if (step.relation === 'child') generationDelta -= 1;
      if (step.relation === 'spouse') spouseLinks += 1;
      if (step.relation === 'sibling' && siblingIndex < 0) siblingIndex = index;
    });

    let route = 'unknown';
    if (firstRelation === 'spouse') route = 'affinal';
    else if (firstRelation === 'child') route = 'descendant';
    else if (firstRelation === 'sibling') route = 'collateral';
    else if (firstParentGender === 'male') route = 'paternal';
    else if (firstParentGender === 'female') route = 'maternal';

    const role = deriveKinshipRole(steps);
    const boundary = calculateGenealogicalBoundary({ role, spouseLinks });
    const commonAncestor = boundary.status === 'calculated' && boundary.basis === 'nearest-common-ancestor'
      ? {
          egoDistance: boundary.egoDistance,
          targetDistance: boundary.targetDistance,
          confidence: 'high',
        }
      : null;
    return {
      generationDelta,
      targetGender: steps.length ? steps[steps.length - 1].gender : (context?.egoGender || 'unknown'),
      consanguinity: spouseLinks ? 'affinal' : 'blood',
      spouseLinks,
      collateral: siblingIndex >= 0,
      route,
      role,
      structure: role,
      boundary,
      ...(commonAncestor ? { commonAncestor } : {}),
    };
  }

  function invertSeniority(value) {
    if (value === 'older') return 'younger';
    if (value === 'younger') return 'older';
    return value || 'unknown';
  }

  function inverseStep(originalStep, previousPersonGender) {
    if (originalStep.relation === 'parent') return makeStep('child', previousPersonGender);
    if (originalStep.relation === 'child') return makeStep('parent', previousPersonGender);
    if (originalStep.relation === 'spouse') return makeStep('spouse', previousPersonGender);
    if (originalStep.relation === 'sibling') {
      return makeStep('sibling', previousPersonGender, invertSeniority(originalStep.seniority));
    }
    throw new KinshipError('NON_INVERTIBLE_STEP', '路径中存在无法反转的关系。');
  }

  function makeStep(relation, gender, seniority) {
    const token = Object.keys(ATOMS).find((key) => {
      const atom = ATOMS[key];
      return atom.relation === relation && atom.gender === gender &&
        (relation !== 'sibling' || atom.seniority === (seniority || 'unknown'));
    });
    if (token) return { token, ...ATOMS[token] };

    const genderLabel = gender === 'male' ? '男性' : gender === 'female' ? '女性' : '未知性别';
    const relationLabel = {
      parent: '父母', child: '子女', spouse: '配偶', sibling: '兄弟姐妹',
    }[relation];
    return { relation, gender: gender || 'unknown', seniority, label: `${genderLabel}${relationLabel}` };
  }

  function invertPath(steps, egoGender) {
    const personGenders = [egoGender, ...steps.map((step) => step.gender)];
    const inverse = [];
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      inverse.push(inverseStep(steps[i], personGenders[i]));
    }
    return inverse;
  }

  function describeFallback(steps, semantics) {
    const role = semantics.role;
    if (role && role.frame.origin === 'spouse-family') {
      const frame = role.frame.spouseGender === 'female' ? '妻方' : role.frame.spouseGender === 'male' ? '夫方' : '配偶一方';
      const endpoint = semantics.targetGender === 'male' ? '男性' : semantics.targetGender === 'female' ? '女性' : '';
      const generation = semantics.generationDelta > 0 ? '长辈' : semantics.generationDelta < 0 ? '晚辈' : '同辈';
      const branch = role.kind === 'collateral' || role.kind === 'unclassified' ? '旁系' : '直系';
      return `${frame}${endpoint}${generation}${branch}亲属`;
    }
    const endpoint = semantics.targetGender === 'male' ? '男性' : semantics.targetGender === 'female' ? '女性' : '';
    const generation = semantics.generationDelta > 0
      ? '长辈'
      : semantics.generationDelta < 0
        ? '晚辈'
        : '同辈';
    const side = {
      paternal: '父系', maternal: '母系', affinal: '配偶一侧',
      descendant: '后代', collateral: '旁系', unknown: '',
    }[semantics.route];
    const kind = semantics.spouseLinks ? '姻亲' : '亲属';
    return `${side}${endpoint}${generation}${kind}` || '亲属';
  }

  function cloneOutput(output) {
    return JSON.parse(JSON.stringify(output));
  }

  function cloneResultShell(result) {
    return JSON.parse(JSON.stringify(result));
  }

  function explain(steps, semantics, matchedRule) {
    const pathText = steps.length ? steps.map((step) => step.label).join(' → ') : '己身';
    const generationText = semantics.generationDelta === 0
      ? '与己身同辈'
      : semantics.generationDelta > 0
        ? `比己身高 ${semantics.generationDelta} 辈`
        : `比己身低 ${Math.abs(semantics.generationDelta)} 辈`;
    const routeText = {
      paternal: '路径从父系进入', maternal: '路径从母系进入',
      affinal: '路径从配偶一侧进入', descendant: '路径从子女一侧进入',
      collateral: '路径从同辈旁系进入', unknown: '路径系别未知',
    }[semantics.route];
    const lines = [
      `规范路径：${pathText}`,
      `${routeText}，${generationText}，${semantics.consanguinity === 'blood' ? '未经配偶边' : `经过 ${semantics.spouseLinks} 条配偶边`}。`,
      matchedRule ? `命中规则：${matchedRule.id}` : '未命中精确规则，使用描述性回退。',
    ];
    if (matchedRule && matchedRule.metadata && matchedRule.metadata.usage) {
      lines.push(`用语性质：${matchedRule.metadata.usage}。`);
    }
    return lines;
  }

  function pickReverseFields(reverse) {
    return {
      status: reverse.status,
      term: reverse.term,
      termMode: reverse.termMode,
      terms: reverse.terms,
      candidates: reverse.candidates,
      normalizedPath: reverse.normalizedPath,
      matchedRuleId: reverse.matchedRuleId,
      resolutionStrategy: reverse.resolutionStrategy,
      genealogicalBoundary: reverse.genealogicalBoundary,
      ritualClassification: reverse.ritualClassification,
      missingFacts: reverse.missingFacts,
    };
  }

  function resolveReverse(steps, context) {
    const inverse = invertPath(steps, context.egoGender);
    const reverseContext = {
      ...context,
      egoGender: steps.length ? steps[steps.length - 1].gender : context.egoGender,
      targetRelativeAge: invertSeniority(context.targetRelativeAge),
    };
    const normalized = canonicalizePathCandidates(inverse, reverseContext);
    const resolved = normalized.candidates.map((candidate) =>
      resolveSteps(candidate.steps, reverseContext, false, candidate.assumptions, inverse),
    );
    if (resolved.length === 1) return pickReverseFields(resolved[0]);
    const merged = mergeCandidateResults(resolved, normalized, inverse);
    return pickReverseFields(merged);
  }

  function resolveSteps(steps, context, includeReverse, assumptions, originalPath) {
    const semantics = extractSemantics(steps, context);
    const exactRule = findRule(steps, context);
    const roleRule = exactRule ? null : findRoleTerm(semantics.role, context);
    const stepParentRule = exactRule || roleRule ? null : findStepParentTerm(steps, context);
    const contextualRule = exactRule || roleRule || stepParentRule ? null : findContextualAffinalTerm(steps, context);
    const bridgeRule = exactRule || roleRule || stepParentRule || contextualRule ? null : findBridgeRelativeTerm(steps, context);
    const matchedRule = exactRule || roleRule || stepParentRule || contextualRule || bridgeRule;
    const resolutionStrategy = exactRule
      ? 'exact-path-rule'
      : roleRule
        ? 'structural-classification'
        : stepParentRule
          ? 'step-parent'
          : contextualRule
          ? 'contextual-affinal'
          : bridgeRule
            ? 'bridge-relative'
            : 'descriptive-fallback';
    const output = matchedRule
      ? cloneOutput(matchedRule.output)
      : {
          status: 'descriptive',
          reference: [{ value: describeFallback(steps, semantics), register: 'neutral', preferred: true }],
          address: [],
          candidates: [],
          missingFacts: [],
        };

    const preferredTerms = context.mode === 'address' && output.address.length
      ? output.address
      : output.reference;
    const result = {
      status: output.status,
      term: preferredTerms[0].value,
      termMode: context.mode === 'address' && output.address.length ? 'address' : 'reference',
      terms: { reference: output.reference, address: output.address },
      candidates: output.candidates || [],
      originalPath: (originalPath || steps).map((step) => ({ ...step })),
      normalizedPath: steps.map((step) => ({ ...step })),
      semantics,
      matchedRuleId: matchedRule ? matchedRule.id : null,
      termMetadata: matchedRule && matchedRule.metadata ? { ...matchedRule.metadata } : null,
      resolutionStrategy,
      explanation: explain(steps, semantics, matchedRule),
      assumptions: assumptions || [],
      missingFacts: output.missingFacts || [],
      needsTargetAge: Boolean(output.needsTargetAge),
      genealogicalBoundary: semantics.boundary,
      ritualClassification: assessFiveFu(semantics.boundary),
    };

    if (includeReverse) {
      result.reverse = resolveReverse(steps, context);
    }

    return result;
  }

  function uniqueStrings(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function uniqueTerms(groups) {
    const seen = new Set();
    return groups.flat().filter((item) => {
      const key = `${item.value}|${item.register || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function possibleTerms(result) {
    if (result.status === 'ambiguous' && result.candidates.length) return result.candidates;
    return [result.term];
  }

  function mergeBoundaries(boundaries) {
    const serialized = boundaries.map((boundary) => JSON.stringify({
      status: boundary && boundary.status,
      egoDistance: boundary && boundary.egoDistance,
      targetDistance: boundary && boundary.targetDistance,
      basis: boundary && boundary.basis,
    }));
    if (new Set(serialized).size === 1) return boundaries[0];
    return {
      status: 'unknown',
      reason: '多个规范候选具有不同的谱系坐标，不把其中一条当作唯一事实。',
    };
  }

  function mergeCandidateResults(resolvedCandidates, normalized, originalSteps) {
    const snapshots = resolvedCandidates.map((result, index) => ({
      term: result.term,
      status: result.status,
      candidates: [...(result.candidates || [])],
      terms: cloneOutput(result.terms),
      normalizedPath: result.normalizedPath.map((step) => ({ ...step })),
      rewriteTrace: (normalized.candidates[index].rewriteTrace || []).map((entry) => ({ ...entry })),
      matchedRuleId: result.matchedRuleId,
      resolutionStrategy: result.resolutionStrategy,
      possible: possibleTerms(result),
      reverse: result.reverse ? pickReverseFields(result.reverse) : null,
      genealogicalBoundary: result.genealogicalBoundary,
    }));

    const merged = cloneResultShell(resolvedCandidates[0]);
    const candidateTerms = uniqueStrings(snapshots.flatMap((item) => item.possible));
    const reverseTerms = uniqueStrings(snapshots.flatMap((item) => (
      item.reverse ? (item.reverse.status === 'ambiguous' && item.reverse.candidates.length
        ? item.reverse.candidates
        : [item.reverse.term]) : []
    )));

    merged.status = 'ambiguous';
    merged.candidates = candidateTerms;
    merged.terms = {
      reference: uniqueTerms(snapshots.map((item) => item.terms.reference)),
      address: uniqueTerms(snapshots.map((item) => item.terms.address)),
    };
    merged.originalPath = originalSteps.map((step) => ({ ...step }));
    merged.resolutionStrategy = 'candidate-chain';
    merged.matchedRuleId = null;
    merged.missingFacts = uniqueStrings([
      ...resolvedCandidates.flatMap((result) => result.missingFacts),
      ...normalized.candidates.flatMap((candidate) => candidate.missingFacts),
    ]);
    merged.needsTargetAge = resolvedCandidates.some((result) => result.needsTargetAge);
    merged.assumptions = uniqueStrings(normalized.candidates.flatMap((candidate) => candidate.assumptions));
    merged.genealogicalBoundary = mergeBoundaries(snapshots.map((item) => item.genealogicalBoundary));
    merged.ritualClassification = assessFiveFu(merged.genealogicalBoundary);
    merged.pathAlternatives = snapshots.map((item) => ({
      term: item.term,
      status: item.status,
      candidates: item.candidates,
      normalizedPath: item.normalizedPath,
      rewriteTrace: item.rewriteTrace,
      matchedRuleId: item.matchedRuleId,
      resolutionStrategy: item.resolutionStrategy,
    }));
    merged.explanation = [
      `关系链归一化得到 ${snapshots.length} 个不可再化简的候选。`,
      ...snapshots.map((item) =>
        `${item.normalizedPath.length ? item.normalizedPath.map((step) => step.label).join(' → ') : '己身'}：${item.possible.join(' / ')}`,
      ),
    ];
    if (merged.reverse && reverseTerms.length > 1) {
      merged.reverse = {
        ...merged.reverse,
        status: 'ambiguous',
        candidates: reverseTerms,
        resolutionStrategy: 'candidate-chain',
        matchedRuleId: null,
      };
    }
    return merged;
  }

  function resolveKinship(path, ctx) {
    const parsed = parsePath(path);
    const context = normalizeContext({
      ...ctx,
      targetRelativeAge: (ctx && RELATIVE_AGES.includes(ctx.targetRelativeAge) && ctx.targetRelativeAge !== 'unknown')
        ? ctx.targetRelativeAge
        : (parsed.impliedAge || (ctx && ctx.targetRelativeAge) || 'unknown'),
    });
    const originalSteps = parsed.steps;
    const normalized = canonicalizePathCandidates(originalSteps, context);
    const resolvedCandidates = normalized.candidates.map((candidate) => {
      const result = resolveSteps(candidate.steps, context, true, candidate.assumptions, originalSteps);
      result.rewriteTrace = candidate.rewriteTrace.map((entry) => ({ ...entry }));
      result.normalization = {
        reachedFixedPoint: normalized.reachedFixedPoint,
        exploredStates: normalized.exploredStates,
        candidateCount: normalized.candidates.length,
      };
      result.missingFacts = uniqueStrings([...result.missingFacts, ...candidate.missingFacts]);
      return result;
    });
    if (resolvedCandidates.length === 1) return resolvedCandidates[0];
    const merged = mergeCandidateResults(resolvedCandidates, normalized, originalSteps);
    merged.normalization = {
      reachedFixedPoint: normalized.reachedFixedPoint,
      exploredStates: normalized.exploredStates,
      candidateCount: normalized.candidates.length,
    };
    return merged;
  }

  // Read-only integration surface for relationship pickers. Keeping this list
  // derived from ATOMS prevents the interface from maintaining a second graph.
  function listRelationshipAtoms() {
    const generationDelta = { parent: 1, sibling: 0, spouse: 0, child: -1 };
    return Object.entries(ATOMS).map(([id, atom]) => ({
      id,
      ...atom,
      seniority: atom.seniority || 'unknown',
      generationDelta: generationDelta[atom.relation] || 0,
    }));
  }

  function KinshipError(code, message, details) {
    this.name = 'KinshipError';
    this.code = code;
    this.message = message;
    this.details = details || {};
    if (Error.captureStackTrace) Error.captureStackTrace(this, KinshipError);
  }
  KinshipError.prototype = Object.create(Error.prototype);
  KinshipError.prototype.constructor = KinshipError;

  return {
    resolveKinship,
    normalizePath,
    parsePath,
    simplifyPath,
    canonicalizePathCandidates,
    extractSemantics,
    deriveKinshipRole,
    classifyStructure,
    calculateGenealogicalBoundary,
    assessFiveFu,
    invertPath,
    listRelationshipAtoms,
    rules,
    structuralTermPacks: STRUCTURAL_TERM_PACKS,
    aliases: { ...ALIASES },
    rewriteRules: PATH_REWRITE_RULES.map(({ id, priority }) => ({ id, priority })),
    KinshipError,
  };
});
