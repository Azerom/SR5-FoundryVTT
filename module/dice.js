import { Helpers } from './helpers.js';
import { SR5 } from './config.js';

/**
 * @param {Event} event         The triggering event which initiated the roll
 * @param {Number} count        The number of d6's to roll
 * @param {Actor} actor         The actor making the d6 roll
 * @param {Number} limit        The limit for the roll -- leave undefined for no limit
 *
 */

export class DiceSR {
  static d6({event, count, actor, limit, title}) {

    const roll = (count, limit, explode) => {
      let formula = `${count}d6`;
      if (explode) {
        formula += 'x6';
      }
      if (limit) {
        formula += `kh${limit}`;
      }

      formula += 'cs>=5'

      let roll = new Roll(formula);

      roll.toMessage({
        flavor: title
      });

      return roll;
    };

    if (Helpers.hasModifiers(event)) {
      if (event[SR5.kbmod.EDGE]) return roll(count, 0, true);
      return roll(count, limit, false);
    }

    let dialogData = {
      dice_pool: count,
      mod: ""
    };
    let template = 'systems/shadowrun5e/templates/rolls/roll-dialog.html';
    let edge = false;
    return new Promise(resolve => {
      renderTemplate(template, dialogData).then(dlg => {
        new Dialog({
          title: title,
          content: dlg,
          buttons: {
            roll: {
              label: 'Roll',
              icon: '<i class="fas fa-dice-six"></i>'
            },
            edge: {
              label: 'Edge',
              icon: '<i class="fas fa-bomb"></i>',
              callback: () => edge = true
            }
          },
          default: 'roll',
          close: html => {
            let mod = parseInt(html.find('[name="mod"]').val());
            if (!isNaN(mod)) count += mod;
            if (edge) limit = undefined;
            let r = roll(count, limit, edge);
            resolve(r);
          }
        }).render(true);
      });
    });
  }
}
