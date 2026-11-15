// example-screens.js — SCREENS registry built ONLY from ui-kit.js components (template to copy).
// Each screen = data + composition. No px, no hex, no sprite paths, no left/top in this file.
// Run checks:  node layout-lint.js --screens example-screens.js
(function (root) {
  const K = typeof module !== 'undefined' && module.exports ? require('./ui-kit.js') : root.UIKit;
  const ICON = 'assets/sprites/placeholder.png'; // replace with the game's real icon paths

  const SCREENS = [
    {
      id: 'confirm_upgrade', group: 'Templates', label: 'Confirm popup (before → after + cost)',
      render() {
        return K.scrim(K.popup({
          size: 's', title: 'Upgrade',
          body: [
            K.hero({ icon: ICON, rarity: 'rare', title: 'Item name', subtitle: 'Tier 2/6 · Rare' }),
            K.compareTable([['Damage', '+20%', '+45%'], ['Max level', '19', '29']]),
            K.costChips([{ icon: ICON, text: '3/5', ok: false }, { icon: ICON, text: '40.000', ok: true }]),
          ],
          footer: K.button('Not enough material', { variant: 'action', state: 'soft-off' }),
        }));
      },
      mapping: [['Whole popup', 'Template composition — replace data with the real game values', 'new']],
    },
    {
      id: 'result_reward', group: 'Templates', label: 'Result popup (big value + new item card)',
      render() {
        return K.scrim(K.popup({
          size: 's', title: 'Success!',
          body: [
            K.hero({ icon: ICON, rarity: 'epic', value: 'Lv 10', subtitle: 'Item name · Tier 1/6' }),
            K.compareTable([['Damage', '+0%', '+20%']]),
            K.newCard({ icon: ICON, kicker: 'New passive', title: 'Skill name', desc: '+20% damage', badgeText: 'NEW' }),
          ],
          footer: K.button('Continue'),
        }));
      },
      mapping: [['Whole popup', 'Template composition', 'new']],
    },
    {
      id: 'info_list', group: 'Templates', label: 'Info popup (header + list rows + warning)',
      render() {
        return K.scrim(K.popup({
          size: 'm', title: 'Item info',
          body: [
            K.listRow({ icon: ICON, rarity: 'common', title: 'Material name', subtitle: 'Used to break plants of this element' }),
            K.text('Where to get it (2)', 'value'),
            K.stack([K.listRow({ icon: ICON, title: 'Defeat the element boss' }), K.listRow({ icon: ICON, title: 'Complete missions' })], { gap: 2 }),
            K.note('You do not have enough of this item'),
          ],
        }));
      },
      mapping: [['Whole popup', 'Template composition', 'new']],
    },
    {
      id: 'kit_parts', group: 'Templates', label: 'Kit parts (stars, tabs, bar, badges)',
      render() {
        return K.panel([
          K.row([K.stars(3), K.badge('NEW'), K.badge('x2', 'accent')], { gap: 3 }),
          K.tabs(['Overview', 'Skills', 'Stats'], 1),
          K.progressBar(0.62, '62 / 100'),
          K.kvTable([['Coin', '12.500'], ['Missing', '2', 'bad']]),
        ]);
      },
      mapping: [['Parts', 'Template composition', 'new']],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = { SCREENS };
  else root.SCREENS = SCREENS;
})(typeof window !== 'undefined' ? window : globalThis);
