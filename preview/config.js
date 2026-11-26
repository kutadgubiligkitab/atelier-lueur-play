/* PUBLIC build profile configuration. Contains NO personal letter, names, dates or memories (the personal values live only in config.js,
   which public builds never read or copy). Selected with: python3 build.py --profile public  /  node capacitor-app/scripts/build-www.mjs --profile=public */
window.CONFIG = {
  giftMode: false,
  playtestCoinGrant: 60000,  // 0 = off (store/release). The play-site build passes --playtest-coins to set this to 60000.
  contentUrl: '',            // set to the production content endpoint once it exists; '' = bundled content only
  progressionProfile: 'v2',
  giftName: '',
  secretLevel: 0,
  letter: '',
  letterFrom: '',
  memories: [],
};
