import { DiceSR } from '../dice.js';
import { Helpers } from '../helpers.js';

export class SR5Item extends Item {

  _previousFireMode = 1;

  get hasOpposedRoll() {
    return !!(this.data.data.action && this.data.data.action.opposed.type);
  }

  get hasRoll() {
    return !!(this.data.data.action && this.data.data.action.type !== '');
  }

  prepareData() {
    super.prepareData();
    const labels = {};
    const item = this.data;

    if (item.data.action) {
      const action = item.data.action;
      action.limit.mod = 0;
      action.damage.mod = 0;
      action.damage.ap.mod = 0;
      // setup range weapon special shit
      if (item.type !== 'spell' && item.data.range) {
        const range = item.data.range;
        range.rc.mod = 0;
        if (range.mods) {
          // turn object into array
          if (typeof range.mods === 'object') {
            range.mods = Object.values(range.mods);
          }
          range.mods.forEach(mod => {
            if (mod.equipped) {
              if (mod.rc) range.rc.mod += mod.rc;
              if (mod.acc) action.limit.mod += mod.acc;
            }
          });
        }
        if (range.ammo) {
          const ammo = range.ammo;
          // turn object into array
          if (typeof ammo.available === 'object') {
            ammo.available = Object.values(ammo.available);
          }
          if (ammo.available) {
            ammo.available.forEach(v => {
              if (v.equipped) {
                ammo.equipped = v;
                action.damage.mod += v.damage;
                action.damage.ap.mod += v.ap;
              }
            });
          }
        }
        if (range.rc) range.rc.value = range.rc.base + range.rc.mod;
      }


      // once all damage mods have been accounted for, sum base and mod to value
      action.damage.value = action.damage.base + action.damage.mod;
      action.damage.ap.value = action.damage.ap.base + action.damage.ap.mod;
      action.limit.value = action.limit.base + action.limit.mod;
      if (this.actor) {
        if (action.damage.attribute) action.damage.value += this.actor.data.data.attributes[action.damage.attribute].value;
        if (action.limit.attribute) action.limit.value += this.actor.data.data.limits[action.limit.attribute].value;
      }
    }


    if (item.type === 'weapon') {
      const action = item.data.action;
      if (item.data.category === 'thrown') {
        action.skill = 'throwing_weapons';
      }
      action.attribute = CONFIG.SR5.attributes.AGILITY;
    }

    if (item.type === 'spell') {
      item.data.action.attribute = 'magic';
      item.data.action.skill = 'spellcasting';
    }

    if (item.data.condition_monitor) {
      item.data.condition_monitor.max = 8 + Math.ceil(item.data.technology.rating / 2);
    }

    this.labels = labels;
    console.log(item);
  }

  async roll(event) {
    if (Helpers.hasModifiers(event)) {
      return this.rollTest(event);
    }
    const data = this.data.data;
    const token = this.actor.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.scene._id}.${token.id}` : null,
      item: this.data,
      type: this.data.type,
      data: this.getChatData(),
      hasRoll: this.hasRoll,
      hasOpposedRoll: this.hasOpposedRoll,
      labels: this.labels
    };

    const templateType = 'item';
    const template = `systems/shadowrun5e/templates/rolls/${templateType}-card.html`;
    const html = await renderTemplate(template, templateData);

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        actor: this.actor._id,
        token: this.actor.token,
        alias: this.actor.name
      }
    };

    const rollMode = game.settings.get('core', 'rollMode');
    if (['gmroll', 'blindroll'].includes(rollMode)) chatData['whisper'] = ChatMessage.getWhisperIDs('GM');
    if (rollMode === 'blindroll') chatData['blind'] = true;

    return ChatMessage.create(chatData, {displaySheet: false});
  }

  getChatData(htmlOptions) {
    const data = duplicate(this.data.data);
    const labels = this.labels;

    data.description.value = enrichHTML(data.description.value, htmlOptions);

    const props = [];
    this[`_${this.data.type}ChatData`](data, labels, props);

    data.properties = props.filter(p => !!p);

    return data;
  }

  _actionChatData(data, labels, props) {
    if (data.action.limit.value) props.push(`Limit ${data.action.limit.value}`);
    if (data.action.type) props.push(`${Helpers.label(data.action.type)} Action`);
    if (data.action.skill) {
      labels['roll'] = `${Helpers.label(data.action.skill)}+${Helpers.label(data.action.attribute)}`;
    } else if (data.action.attribute2) {
      labels['roll'] = `${Helpers.label(data.action.attribute)}+${Helpers.label(data.action.attribute2)}`;
    }
    if (data.action.damage.type) {
      const damage = data.action.damage;
      if (damage.value) props.push(`DV ${damage.value}${damage.type ? damage.type.toUpperCase().charAt(0) : ''}`);
      if (damage.ap && damage.ap.value) props.push(`AP ${damage.ap.value}`);
      if (damage.element) props.push(Helpers.label(damage.element));
    }
    if (data.action.opposed.type) {
      const opposed = data.action.opposed;
      if (opposed.type !== 'custom') labels['opposedRoll'] = `vs. ${Helpers.label(opposed.type)}`;
      else if (opposed.skill) labels['opposedRoll'] = `vs. ${Helpers.label(opposed.skill)}+${Helpers.labels(opposed.attribute)}`;
      else if (opposed.attribute2) labels['opposedRoll'] = `vs. ${Helpers.label(opposed.attribute)}+${Helpers.labels(opposed.attribute2)}`;
      else if (opposed.attribute) labels['opposedRoll'] = `vs. ${Helpers.label(opposed.attribute)}`;
      if (opposed.description) props.push(`Opposed Desc: ${opposed.desc}`);
    }
  }

  _armorChatData(data, labels, props) {
    if (data.armor) {
      if (data.armor.value) props.push(`Armor ${data.armor.value}`);
      if (data.armor.mod) props.push('Accessory');
      if (data.armor.acid) props.push(`Acid ${data.armor.acid}`);
      if (data.armor.cold) props.push(`Cold ${data.armor.cold}`);
      if (data.armor.fire) props.push(`Fire ${data.armor.fire}`);
      if (data.armor.electricity) props.push(`Electricity ${data.armor.electricity}`);
      if (data.armor.radiation) props.push(`Radiation ${data.armor.radiation}`);
    }
  }

  _spellChatData(data, labels, props) {
    this._actionChatData(data, labels, props);
    props.push(Helpers.label(data.range),
                Helpers.label(data.duration),
                Helpers.label(data.type),
                Helpers.label(data.category));
    if (data.category === 'combat') {
      props.push(Helpers.label(data.combat.type));
    } else if (data.category === 'health') {

    } else if (data.category === 'illusion') {
      props.push(data.illusion.type);
      props.push(data.illusion.sense);
    } else if (data.category === 'manipulation') {
      if (data.manipulation.damaging) props.push('Damaging');
      if (data.manipulation.mental) props.push( 'Mental');
      if (data.manipulation.environmental) props.push('Environmental');
      if (data.manipulation.physical) props.push( 'Physical');
    } else if (data.category === 'detection') {
      props.push(data.illusion.passive ? 'Passive' : 'Active');
      props.push(data.illusion.type);
      if (data.illusion.extended) props.push('Extended');
    }
    labels['roll'] = 'Cast';
  }

  _cyberwareChatData(data, labels, props) {
    _weaponChatData(data, labels, props);
    _armorChatData(data, labels, props);
    if (data.essence) props.push(`Ess ${data.essence}`);
  }

  _weaponChatData(data, labels, props) {
    this._actionChatData(data, labels, props);

    if (data.category === 'range') {
      if (data.range.rc) props.push(`RC ${data.range.rc.value}`);
      const ammo = data.range.ammo;
      const curr = ammo.equipped;
      if (curr.name) props.push(` ${ammo.value}/${ammo.max} ${curr.name}`);
      if (curr.blast.radius) props.push(`${curr.blast.radius}m`);
      if (curr.blast.dropoff) props.push(`${curr.blast.dropoff}/m`);
      if (data.range.modes) props.push(Array.from(Object.entries(data.range.modes)).filter(([key, val]) => val).map(([key, val]) => Helpers.label(key)).join('/'));
      if (data.range.range) props.push(Array.from(Object.values(data.range.range)).join('/'));
    } else if (data.category === 'melee') {
      if (data.melee.reach) props.push(`Reach ${data.melee.reach}`);
    } else if (data.category === 'thrown') {
      if (data.thrown.range) props.push(data.thrown.range);
      const blast = data.thrown.blast;
      if (blast.value) props.push(`Radius ${blast.radius}m`);
      if (blast.dropoff) props.push(`Dropoff ${blast.dropoff}/m`);
    }
  }

  _adept_powerChatData(data, labels, props) {
    this._actionChatData(data, labels, props);
    this._
    props.push(`PP ${data.pp}`);
    props.push(Helpers.label(data.type));
    if (data.type === 'active') {
      props.push(`${Helpers.label(data.action.type)} Action`);
    }
  }

  addWeaponMod() {
    const data = duplicate(this.data);
    const range = data.data.range;
    if (typeof range.mods === 'object') {
      range.mods = Object.values(range.mods);
    }
    range.mods.push({
      equipped: false,
      name: '',
      acc: 0,
      rc: 0,
      desc: ''
    });
    this.update(data);
  }

  equipWeaponMod(index) {
    const data = duplicate(this.data);
    const mods = data.data.range.mods;
    mods[index].equipped = !mods[index].equipped;
    this.update(data);
  }

  removeWeaponMod(index) {
    const data = duplicate(this.data);
    const mods = data.data.range.mods;
    mods.splice(index, 1);
    this.update(data);
  }

  reloadAmmo() {
    const data = duplicate(this.data);
    const ammo = data.data.range.ammo;
    ammo.available.forEach(v => {
      if (v.equipped) v.qty = Math.max(0, v.qty - (ammo.max - ammo.value));
    });
    ammo.value = ammo.max;
    this.update(data);
  }

  equipAmmo(index) {
    const data = duplicate(this.data);
    const ammo = data.data.range.ammo;
    ammo.available.forEach((v, i) => {
      v.equipped = (i === index);
    });
    this.update(data);
  }

  removeAmmo(index) {
    const data = duplicate(this.data);
    const ammo = data.data.range.ammo;
    ammo.available.splice(index, 1);
    this.update(data);
  }

  addNewAmmo() {
    const data = duplicate(this.data);
    const ammo = data.data.range.ammo;
    if (typeof ammo.available === 'object') {
      ammo.available = Object.values(ammo.available);
    }
    ammo.available.push({
      equipped: false,
      name: '',
      damage: 0,
      ap: 0,
      blast: {
        radius: 0,
        dropoff: 0
      }
    });
    this.update(data);
  }

  rollOpposedTest(target, ev) {
    const itemData = this.data.data;
    let options = {event: ev};

    if (this.data.type === 'weapon' && this.data.data.category === 'range' && itemData.range.previousFireMode) {
      let mod = Helpers.mapRoundsToDefenseMod(itemData.range.previousFireMode);
      options.fireModeDefense = mod;
      options.cover = true;
    }

    const opposed = itemData.action.opposed;
    if (opposed.type === 'defense') target.rollDefense(options);
    if (opposed.type === 'soak') target.rollSoak(options);
    if (opposed.type === 'armor') target.rollSoak(options);
    else {
      if (opposed.skill && opposed.attribute) target.rollSkill(opposed.skill, {...options, attribute: opposed.attribute});
      if (opposed.attribute && opposed.attribute2) target.rollTwoAttributes([opposed.attribute, opposed.attribute2], options);
      else if (opposed.attribute) target.rollSingleAttribute(opposed.attribute, options);
    }
  }

  rollTest(ev) {
    const itemData = this.data.data;
    const actorData = this.actor.data.data;

    let skill = actorData.skills.active[itemData.action.skill];
    let attribute = actorData.attributes[itemData.action.attribute];
    let attribute2 = actorData.attributes[itemData.action.attribute2];
    let limit = itemData.action.limit.value;
    let spec = itemData.action.spec ? 2 : 0;
    let mod = parseInt(itemData.action.mod || 0);

    // only check if attribute2 is set if skill is not set
    let count = 0;
    if (skill) count = skill.value + attribute.value;
    else if (attribute2) count = attribute.value + attribute2.value;
    else if (attribute) count = attribute.value;
    count += spec + mod;

    let title = `${Helpers.label(skill.label)} + ${Helpers.label(attribute.label)}`;
    title = this.data.data.name;

    if ((this.data.type === 'weapon' || this.data.type === 'cyberware') && itemData.category === 'range') {
      let fireMode = itemData.range.previousFireMode;
      let rc = parseInt(itemData.range.rc.value) + parseInt(actorData.recoil_compensation);
      let dialogData = {
        fireMode: fireMode,
        rc: rc,
        ammo: itemData.range.ammo
      };
      return renderTemplate('systems/shadowrun5e/templates/rolls/range-weapon-roll.html', dialogData).then(dlg => {
        const buttons = {};
        let ranges = itemData.range.range;
        let environmental = true;
        buttons['short'] = {
          label: `Short (${ranges.short})`
        };
        buttons['medium'] = {
          label: `Medium (${ranges.medium})`,
          callback: () => environmental = 1
        };
        buttons['long'] = {
          label: `Long (${ranges.long})`,
          callback: () => environmental = 3
        };
        buttons['extreme'] = {
          label: `Extreme (${ranges.extreme})`,
          callback: () => environmental = 6
        };
        new Dialog({
          title: title,
          content: dlg,
          buttons: buttons,
          close: (html) => {
            const fireMode = parseInt(html.find('[name="fireMode"]').val())
            title = this.data.name;
            if (fireMode) {
              title += ` - Defender (${Helpers.mapRoundsToDefenseDesc(fireMode)})`
            }
            if (fireMode > rc) count -= (fireMode - rc);
            DiceSR.d6({
              event: ev,
              count: count,
              actor: this.actor,
              limit: limit,
              title: title,
              dialogOptions: {
                environmental: environmental
              },
              after: () => {
                const dupData = duplicate(this.data);
                const range = dupData.data.range;
                range.previousFireMode = fireMode;
                const ammo = range.ammo;
                ammo.value = Math.max(0, ammo.value - fireMode);
                this.update(dupData);
                console.log('after');
              }
            });
          }
        }).render(true);
      });
    } else if (this.data.type === 'spell') {
      let dialogData = {
        drain: (itemData.drain >= 0 ? `+${itemData.drain}` : itemData.drain),
        force: 2 - itemData.drain
      };
      let reckless = false;
      renderTemplate('systems/shadowrun5e/templates/rolls/spell-roll.html', dialogData).then(dlg => {
        new Dialog({
          title: `${Helpers.label(this.data.name)} Force`,
          content: dlg,
          buttons: {
            roll: {
              label: 'Roll',
              icon: '<i class="fas fa-dice-six"></i>'
            },
            spec: {
              label: 'Reckless',
              icon: '<i class="fas fa-plus"></i>',
              callback: () => reckless = true
            }
          },
          close: (html) => {
            const force = parseInt(html.find('[name=force]').val());
            limit = force;
            DiceSR.d6({
              event: ev,
              environmental: true,
              count: count,
              actor: this.actor,
              limit: limit,
              title: `${this.data.name}`,
              after: () => {
                const drain = Math.max(itemData.drain + force + (reckless ? 3 : 0), 2);
                this.actor.rollDrain({event: ev}, drain);
              }
            });
          }
        }).render(true);
      });
    } else {
      return DiceSR.d6({
        event: ev,
        count: count,
        environmental: true,
        actor: this.actor,
        limit: limit,
        title: title
      });
    }
  }

  static chatListeners(html) {
    html.on('click', '.card-buttons button', ev => {
      ev.preventDefault();
      const button = $(ev.currentTarget),
            messageId = button.parents('.message').data('messageId'),
            senderId = game.messages.get(messageId).user._id,
            card = button.parents('.chat-card');
      button.disabled = true;
      const action = button.data('action');

      let opposedRoll = action === 'opposed-roll';
      if (!opposedRoll && !game.user.isGM && (game.user._id !== senderId )) return;

      let actor;
      const tokenKey = card.data('tokenId');
      if (tokenKey) {
        const [sceneId, tokenId] = tokenKey.split('.');
        let token;
        if (sceneId === canvas.scene._id) token = canvas.tokens.get(tokenId);
        else {
          const scene = game.scenes.get(sceneId);
          if (!scene) return;
          let tokenData = scene.data.tokens.find(t => t.id === Number(tokenId));
          if (tokenData) token = new Token(tokenData);
        }
        if (!token) return;
        actor = Actor.fromToken(token);
      } else actor = game.actors.get(card.data('actorId'));

      if (!actor) return;
      const itemId = Number(card.data('itemId'));
      const item = actor.getOwnedItem(itemId);

      if (action === 'roll') item.rollTest(ev);
      if (opposedRoll) {
        let targets = this._getChatCardTargets(card);
        for (let t of targets) {
          item.rollOpposedTest(t, ev);
        }
      }

      button.disabled = false;
    });
    html.on('click', '.card-header', ev => {
      ev.preventDefault();
      $(ev.currentTarget).siblings('.card-content').toggle();
    });
    $(html).find('.card-content').hide();
  }

 static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce((arr, t) => t.actor ? arr.concat([t.actor]) : arr, []);
    if ( character && (controlled.length === 0) ) targets.push(character);
    if ( !targets.length ) throw new Error(`You must designate a specific Token as the roll target`);
    return targets;
  }
}
