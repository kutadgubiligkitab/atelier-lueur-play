/* PUBLIC build profile configuration. Contains NO personal letter, names, dates or memories (the personal values live only in config.js,
   which public builds never read or copy). Selected with: python3 build.py --profile public  /  node capacitor-app/scripts/build-www.mjs --profile=public */
window.CONFIG = {
  giftMode: false,
  playtestCoinGrant: 0,  // 0 = off (store/release). The play-site build passes --playtest-coins to set this to 60000.
  playtestGemGrant: 0,   // 0 = off. Only the preview play-site build passes --playtest-gems to set this to 50. The main play root must stay 0.
  starterGift: 1,        // 0 = off. The family play-site build sets this to 1 (10 gems, full energy, 200 coins) once on a new save.

  contentUrl: '',            // set to the production content endpoint once it exists; '' = bundled content only
  progressionProfile: 'v2',
  giftName: '',
  secretLevel: 0,
  letter: '',
  letterFrom: '',
  memories: [],
};
