import { DiceSR } from '../dice.js';
import { Helpers } from '../helpers.js';
import { SR5 } from '../config.js';

export class SR5Actor extends Actor {

  prepareData() {
    super.prepareData();

    const actorData = this.data;
    const items = actorData.items;
    const data = actorData.data;
    const attrs = data.attributes;
    const armor = data.armor;

    attrs.magic.hidden = !(data.special === 'magic');
    attrs.resonance.hidden = !(data.special === 'resonance');

    if (!data.modifiers) data.modifiers = {};
    const mods = {};
    let modifiers = [
      'soak',
      'drain',
      'armor',
      'physical_limit',
      'social_limit',
      'mental_limit',
      'stun_track',
      'physical_track',
      'initiative',
      'initiative_dice',
      'composure',
      'lift_carry',
      'judge_intentions',
      'memory',
      'walk',
      'run',
      'defense',
      'wound_tolerance',
      'essence'
    ];
    modifiers.sort();
    modifiers.unshift('global');

    for (let item of modifiers) {
      mods[item] = data.modifiers[item] || 0;
    }

    data.modifiers = mods;

    Helpers.addLabels(data.skills);
    Helpers.addLabels(data.attributes);
    Helpers.addLabels(data.matrix);

    let totalEssence = 6;
    armor.value = 0;
    armor.mod = 0;
    const ELEMENTS = ['acid', 'cold', 'fire', 'electricity', 'radiation'];
    ELEMENTS.forEach(element => {
      armor[element] = 0;
    });
    const matrix = data.matrix;
    matrix.firewall.value = matrix.firewall.mod;
    matrix.data_processing.value = matrix.data_processing.mod;
    matrix.attack.value = matrix.attack.mod;
    matrix.sleaze.value = matrix.sleaze.mod;

    for (let item of Object.values(items)) {
      if (item.data.armor
        && item.data.armor.value
        && item.data.technology.equipped) {

        if (item.data.armor.mod) armor.mod += item.data.armor.value; // if it's a mod, add to the mod field
        else armor.value = item.data.armor.value; // if not a mod, set armor.value to the items value
        ELEMENTS.forEach(element => {
          armor[element] += item.data.armor[element];
        });
      }
      if (item.data.essence && item.data.technology && item.data.technology.equipped) {
        totalEssence -= item.data.essence;
      }
      if (item.type === 'device' && item.data.technology.equipped) {

        matrix.device = item;
        matrix.condition_monitor.max = item.data.condition_monitor.max;
        matrix.rating = item.data.technology.rating;
        matrix.is_cyberdeck = item.category === 'cyberdeck';
        matrix.name = item.name;

        if (item.data.category === 'cyberdeck') {
          for (let att of Object.values(item.data.atts)) {
            matrix[att.att].value += att.value;
          }
        } else {
          matrix.firewall.value += matrix.rating;
          matrix.data_processing.value += matrix.rating;
        }
      }
    }

    actorData.data.attributes.essence.value = totalEssence + mods.essence;

    const limits = data.limits;
    limits.physical.value = Math.ceil(((2 * attrs.strength.value)
        + attrs.body.value
        + attrs.reaction.value) / 3)
        + mods.physical_limit;
    limits.mental.value = Math.ceil(((2 * attrs.logic.value)
      + attrs.intuition.value
      + attrs.willpower.value) / 3)
      + mods.mental_limit;
    limits.social.value = Math.ceil(((2 * attrs.charisma.value)
      + attrs.willpower.value
      + attrs.essence.value) / 3)
      + mods.social_limit;

    const movement = data.movement;
    movement.walk.value = attrs.agility.value
      * (1 + mods.walk);
    movement.run.value = attrs.agility.value
      * (2 + mods.run);

    const track = data.track;
    track.physical.max = 8 + Math.ceil(attrs.body.value / 2)
      + mods.physical_track;
    track.physical.overflow = attrs.body;
    track.stun.max = 8 + Math.ceil(attrs.willpower.value / 2)
      + mods.stun_track;

    data.recoil_compensation = 1 + Math.ceil(attrs.strength.value / 3);

    const init = data.initiative;
    init.meatspace.base.base = attrs.intuition.value + attrs.reaction.value;
    init.meatspace.dice.base = 1;
    init.astral.base.base = attrs.intuition.value * 2;
    init.astral.dice.base = 2;
    init.matrix.base.base = attrs.intuition.value + data.matrix.data_processing.value;
    init.matrix.dice.base = data.matrix.hot_sim ? 4 : 3;
    if (data.initiative.perception === 'matrix') init.current = init.matrix;
    else if (data.initiative.perception === 'astral') init.current = init.astral;
    else {
      init.current = init.meatspace;
      data.initiative.perception = 'meatspace';
    }
    init.current.dice.value = init.current.dice.base + mods.initiative_dice;
    init.current.dice.text = `${init.current.dice.value}d6`;
    init.current.base.value = init.current.base.base + mods.initiative;

    limits.firewall = {
      value: matrix.firewall.value
    };
    limits.data_processing = {
      value: matrix.data_processing.value
    };
    limits.attack = {
      value: matrix.attack.value
    };
    limits.sleaze = {
      value: matrix.sleaze.value
    };
    armor.value += armor.mod + mods.armor;

    const soak = attrs.body.value + armor.value + mods.soak;
    const drainAtt = attrs[data.magic.attribute];
    data.rolls = {
      ...data.rolls,
      defense: attrs.reaction.value + attrs.intuition.value + mods.defense,
      drain: attrs.willpower.value + (drainAtt ? drainAtt.value : 0) + (data.magic.drain ? data.magic.drain.mod : 0) + mods.drain,
      soak: {
        default: soak,
        cold: soak + armor.cold,
        fire: soak + armor.fire,
        acid: soak + armor.acid,
        electricity: soak + armor.electricity,
        radiation: soak + armor.radiation
      },
      composure: attrs.charisma.value + attrs.willpower.value + mods.composure,
      judge_intentions: attrs.charisma.value + attrs.intuition.value + mods.judge_intentions,
      lift_carry: attrs.strength.value + attrs.body.value + mods.lift_carry,
      memory: attrs.willpower.value + attrs.logic.value + mods.memory
    }

    const knowledgeSkills = data.skills.knowledge;
    for (let [key, category] of Object.entries(knowledgeSkills)) {
      if (typeof category.value === 'object') {
        category.value = Object.values(category.value);
      }
    }
    const language = data.skills.language;
    if (language) {
      if (!language.value) language.value = [];
      if (typeof language.value === 'object') {
        language.value = Object.values(language.value);
      }
      language.attribute = 'intution';
    }

    {
      const count = 3 + mods.wound_tolerance;
      const stunWounds = Math.floor((data.track.stun.max - data.track.stun.value) / count);
      const physicalWounds = Math.floor((data.track.physical.max - data.track.physical.value) / count);

      data.wounds = {
        value: stunWounds + physicalWounds
      }
    }
  }

  rollDrain(options, incoming = -1) {
    const resist = this.data.data.rolls.drain;
    let title = 'Drain';
    if (incoming >= 0) title += ` (${incoming} incoming)`;
    DiceSR.d6({
      event: options.event,
      count: resist,
      actor: this,
      title: title,
      wounds: false
    });
  }

  rollArmor(options) {
    const armor = this.data.data.armor.value;
    return DiceSR.d6({
      event: options.event,
      actor: this,
      count: armor,
      title: 'Armor'
    });
  }

  rollDefense(options) {
    let dialogData = {
      defense: this.data.data.rolls.defense,
      fireMode: options.fireModeDefense,
      cover: options.cover
    };
    let template = 'systems/shadowrun5e/templates/rolls/roll-defense.html';
    let special = '';
    return new Promise(resolve => {
      renderTemplate(template, dialogData).then(dlg => {
        new Dialog({
          title: "Defense",
          content: dlg,
          buttons: {
            normal: {
              label: 'Normal'
            },
            full_defense: {
              label: `Full Defense (+ ${this.data.data.attributes.willpower.value})`,
              callback: () => special = 'full_defense'
            }
          },
          default: 'normal',
          close: html => {
            let count = parseInt(html.find('[name=defense]').val());
            let fireMode = parseInt(html.find('[name=fireMode]').val());
            let cover = parseInt(html.find('[name=cover]').val());
            if (special === 'full_defense') count += this.data.data.attributes.willpower.value;
            if (special === 'dodge') count += this.data.data.skills.active.gymnastics.value;
            if (special === 'block') count += this.data.data.skills.active.unarmed_combat.value;
            if (fireMode) count += fireMode;
            if (cover) count += cover;
            return DiceSR.d6({
              event: options.event,
              actor: this,
              count: count,
              title: 'Defense'
            });
          }
        }).render(true);
      });
    });
  }

  rollSoak(options) {
    let dialogData = {
      ap: options.ap,
      soak: this.data.data.rolls.soak.default
    };
    let id = '';
    let template = 'systems/shadowrun5e/templates/rolls/roll-soak.html';
    return new Promise(resolve => {
      renderTemplate(template, dialogData).then(dlg => {
        new Dialog({
          title: 'Soak Test',
          content: dlg,
          buttons: {
            default: {
              label: 'Base',
              icon: '<i class="fas fa-shield-alt"></i>',
              callback: () => id = 'default'
            },
            acid: {
              label: 'Acid',
              icon: '<i class="fas fa-vial"></i>',
              callback: () => id = 'acid'
            },
            cold: {
              label: 'Cold',
              icon: '<i class="fas fa-snowflake"></i>',
              callback: () => id = 'cold'
            },
            electricity: {
              label: 'Elec',
              icon: '<i class="fas fa-bolt"></i>',
              callback: () => id = 'electricity'
            },
            fire: {
              label: 'Fire',
              icon: '<i class="fas fa-fire"></i>',
              callback: () => id = 'fire'
            },
            radiation: {
              label: 'Rad',
              icon: '<i class="fas fa-radiation"></i>',
              callback: () => id = 'radiation'
            },

          },
          close: (html) => {
            const soak = this.data.data.rolls.soak[id];
            let count = soak;
            const ap = parseInt(html.find('[name=ap]').val());
            if (ap) {
              const armorId = id === 'default' ? '' : id;
              const armor = this.data.data.armor;
              console.log(armor);
              let armorVal = armor.value + (armor[armorId] || 0);
              console.log(armorVal);
              count += Math.max(ap, -armorVal); // don't take more AP than armor
            }
            const label = Helpers.label(id);
            return DiceSR.d6({
              event: options.event,
              actor: this,
              count: count,
              title: `Soak - ${label}`,
              wounds: false
            });
          }
        }).render(true);
      });
    });
  }

  rollSingleAttribute(attId, options) {
    const attr = this.data.data.attributes[attId];
    return DiceSR.d6({
      event: options.event,
      actor: this,
      count: attr.value,
      title: Helpers.label(attrId)
    });
  }

  rollTwoAttributes([id1, id2], options) {
    const attr1 = this.data.data.attributes[id1];
    const attr2 = this.data.data.attributes[id2];
    const label1 = Helpers.label(id1);
    const label2 = Helpers.label(id2);
    return DiceSR.d6({
      event: options.event,
      actor: this,
      count: attr1.value + attr2.value,
      title: `${label1} + ${label2}`
    });
  }

  rollMatrixAttribute(attr, options) {
    let matrix_att = this.data.data.matrix[attr];

    if (Helpers.hasModifiers(options.event)) {
      return DiceSR.d6({
        event: options.event,
        actor: this,
        count: matrix_att.value + (options.event[SR5.kbmod.SPEC] ? 2 : 0),
        limit: limit ? limit.value : undefined,
        title: `${Helpers.label(matrix_att)}`
      });
    }
    const attributes = Helpers.filter(this.data.data.attributes, ([key, value]) => value.value > 0);
    const attribute = 'willpower';

    let dialogData = {
      attribute: attribute,
      attributes: attributes
    };
    let spec = false;
    renderTemplate('systems/shadowrun5e/templates/rolls/matrix-roll.html', dialogData).then(dlg => {
      new Dialog({
        title: `${Helpers.label(matrix_att.label)} Test`,
        content: dlg,
        buttons: {
          roll: {
            label: 'Normal'
          },
          spec: {
            label: 'Spec',
            callback: () => spec = true
          }
        },
        close: (html) => {
          const newAtt = html.find('[name=attribute]').val();
          let att = "";
          if (newAtt) att = this.data.data.attributes[newAtt];
          let count = matrix_att.value + (att.value || 0) + (spec ? 2 : 0);
          return DiceSR.d6({
            event: options.event,
            actor: this,
            count: count,
            title: `${matrix_att.label} + ${att.label}`
          });

        }
      }).render(true);
    });
  }

  promptRoll(options) {
    return DiceSR.d6({
      event: options.event,
      actor: this,
      dialogOptions: {
        prompt: true
      }
    });
  }

  rollAttributesTest(rollId, options) {
    const label = Helpers.label(rollId);
    const roll = this.data.data.rolls[rollId];
    return DiceSR.d6({
      event: options.event,
      actor: this,
      count: roll,
      title: label
    });
  }

  rollSkill(skill, options) {
    let att = this.data.data.attributes[skill.attribute];
    if (options.attribute) att = this.data.data.attributes[options.attribute];
    let spec = false;
    let limit = this.data.data.limits[att.limit];

    if (Helpers.hasModifiers(options.event)) {
      return DiceSR.d6({
        event: options.event,
        actor: this,
        count: skill.value + att.value + (options.event[SR5.kbmod.SPEC] ? 2 : 0),
        limit: limit ? limit.value : undefined,
        title: `${Helpers.label(skill.label)} Test`
      });
    }
    let dialogData = {
      attribute: skill.attribute,
      attributes: Helpers.filter(this.data.data.attributes, ([key, value]) => value.value > 0),
      limit: att.limit,
      limits: this.data.data.limits
    };
    renderTemplate('systems/shadowrun5e/templates/rolls/skill-roll.html', dialogData).then(dlg => {
      new Dialog({
        title: `${Helpers.label(skill.label)} Test`,
        content: dlg,
        buttons: {
          roll: {
            label: 'Normal'
          },
          spec: {
            label: 'Spec',
            callback: () => spec = true
          }
        },
        close: (html) => {
          const newAtt = html.find('[name="attribute"]').val();
          const newLimit = html.find('[name="attribute.limit"]').val();
          att = this.data.data.attributes[newAtt];
          limit = this.data.data.limits[newLimit];
          let count = (skill.value > 0 ? skill.value : -1) + att.value + (spec ? 2 : 0);
          return DiceSR.d6({
            event: options.event,
            actor: this,
            count: count,
            limit: limit ? limit.value : undefined,
            title: `${skill.label} Test`
          });

        }
      }).render(true);
    });
  }

  rollKnowledgeSkill(catId, skillId, options) {
    const category = this.data.data.skills.knowledge[catId];
    const skill = duplicate(category.value[skillId]);
    skill.attribute = category.attribute;
    skill.label = skill.name;
    this.rollSkill(skill, options);
  }

  rollLanguageSkill(skillId, options) {
    const skill = duplicate(this.data.data.skills.language.value[skillId]);
    skill.attribute = 'intuition';
    skill.label = skill.name;
    this.rollSkill(skill, options);
  }

  rollActiveSkill(skillId, options) {
    const skill = this.data.data.skills.active[skillId];
    this.rollSkill(skill, options);
  }

  rollAttribute(attId, options) {
    let label = Helpers.label(attId);
    const att = this.data.data.attributes[attId];
    const atts = this.data.data.attributes;
    let dialogData = {
      attrribute: att,
      attributes: atts
    };
    let defaulting = false;
    renderTemplate('systems/shadowrun5e/templates/rolls/single-attribute.html', dialogData).then(dlg => {
      new Dialog({
        title: `${label} Attribute Test`,
        content: dlg,
        buttons: {
          roll: {
            label: 'Continue'
          }
        },
        default: 'roll',
        close: html => {
          let count = att.value;
          let limit = undefined;
          let title = label

          const att2Id = html.find('[name=attribute2]').val();
          if (att2Id !== 'none') {
            const att2 = atts[att2Id];
            const att2IdLabel = Helpers.label(att2Id);
            count += att2.value;
            title += ` + ${att2IdLabel}`
          }
          return DiceSR.d6({
            event: options.event,
            actor: this,
            count: count,
            limit: limit,
          });
        }
      }).render(true);
    });
  }
}
