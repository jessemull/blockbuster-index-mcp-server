module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'amazon',
        'bls',
        'broadband',
        'census',
        'walmart',
        'blockbuster-index',
        'config',
        'repositories',
        'services',
        'signals',
        'types',
        'util',
        'ci',
        'docs',
        'deps',
      ],
    ],
    'scope-empty': [1, 'never'],
    'subject-case': [2, 'never', ['start-case', 'pascal-case', 'upper-case']],
  },
};
