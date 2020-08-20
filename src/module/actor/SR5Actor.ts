import { ShadowrunRoller } from '../rolls/ShadowrunRoller';
import { Helpers } from '../helpers';
import { SR5Item } from '../item/SR5Item';
import ActorRollOptions = Shadowrun.ActorRollOptions;
import DefenseRollOptions = Shadowrun.DefenseRollOptions;
import SoakRollOptions = Shadowrun.SoakRollOptions;
import AttributeField = Shadowrun.AttributeField;
import SkillRollOptions = Shadowrun.SkillRollOptions;
import SkillField = Shadowrun.SkillField;
import ValueMaxPair = Shadowrun.ValueMaxPair;
import ModList = Shadowrun.ModList;
import BaseValuePair = Shadowrun.BaseValuePair;
import ModifiableValue = Shadowrun.ModifiableValue;
import LabelField = Shadowrun.LabelField;
import LimitField = Shadowrun.LimitField;
import { SYSTEM_NAME } from '../constants';
import { BaseActorPrep } from './prep/BaseActorPrep';
import SR5ActorType = Shadowrun.SR5ActorType;
import { PartsList } from '../parts/PartsList';

export class SR5Actor extends Actor {
    async update(data, options?) {
        await super.update(data, options);
        // trigger update for all items with action
        // needed for rolls to properly update when items or attributes update
        const itemUpdates: Item[] = [];
        // @ts-ignore
        for (let item of this.data.items) {
            if (item && item.data.action) {
                itemUpdates.push(item);
            }
        }
        await this.updateEmbeddedEntity('OwnedItem', itemUpdates);
        return this;
    }

    getOverwatchScore() {
        const os = this.getFlag(SYSTEM_NAME, 'overwatchScore');
        return os !== undefined ? os : 0;
    }

    async setOverwatchScore(value) {
        const num = parseInt(value);
        if (!isNaN(num)) {
            return this.setFlag(SYSTEM_NAME, 'overwatchScore', num);
        }
    }

    prepareData() {
        super.prepareData();

        const actorData = this.data as SR5ActorType;
        const prepper = new BaseActorPrep(actorData);
        prepper.prepareModifiers();
        prepper.prepareArmor();
        prepper.prepareCyberware();
        prepper.prepareSkills();
        prepper.prepareAttributes();
        prepper.prepareMatrix();
        prepper.prepareLimits();
        prepper.prepareConditionMonitors();
        prepper.prepareMovement();
        prepper.prepareWounds();
        prepper.prepareInitiative();

        const data = actorData.data;
        if (data.magic.drain && !data.magic.drain.mod) data.magic.drain.mod = [];
    }

    getModifier(modifierName: string): number | undefined {
        return this.data.data.modifiers[modifierName];
    }

    findActiveSkill(skillName?: string): SkillField | undefined {
        if (skillName === undefined) return undefined;
        return this.data.data.skills.active[skillName];
    }

    findAttribute(attributeName?: string): AttributeField | undefined {
        if (attributeName === undefined) return undefined;
        return this.data.data.attributes[attributeName];
    }

    getEquippedMatrixDevice(): SR5Item | undefined {
        return this.items.find((item: SR5Item) => item.isDevice());
    }

    getEquippedArmor(): SR5Item[] | undefined {
        return this.items.filter((item: SR5Item) => item.isArmor());
    }

    findLimitFromAttribute(attributeName?: string): LimitField | undefined {
        if (attributeName === undefined) return undefined;
        const attribute = this.findAttribute(attributeName);
        if (!attribute?.limit) return undefined;
        return this.findLimit(attribute.limit);
    }

    findLimit(limitName?: string): LimitField | undefined {
        if (!limitName) return undefined;
        return this.data.data.limits[limitName];
    }

    getWoundModifier(): number {
        return -1 * this.data.data.wounds?.value || 0;
    }

    getEdge(): AttributeField & ValueMaxPair<number> {
        return this.data.data.attributes.edge;
    }

    getArmor(): BaseValuePair<number> & ModifiableValue & LabelField {
        return this.data.data.armor;
    }

    getOwnedItem(itemId: string): SR5Item | null {
        return (super.getOwnedItem(itemId) as unknown) as SR5Item;
    }

    getMatrixDevice(): SR5Item | undefined | null {
        const matrix = this.data.data.matrix;
        if (matrix.device) return this.getOwnedItem(matrix.device);
        return undefined;
    }

    getFullDefenseAttribute(): AttributeField | undefined {
        let att = this.data.data.full_defense_attribute;
        if (!att) att = 'willpower';
        return this.findAttribute(att);
    }

    getEquippedWeapons(): SR5Item[] {
        return this.items.filter((item) => item.isEquipped() && item.data.type === 'weapon');
    }

    getRecoilCompensation(): number {
        return this.data.data.recoil_compensation ?? 0;
    }

    addKnowledgeSkill(category, skill?) {
        const defaultSkill = {
            name: '',
            specs: [],
            base: 0,
            value: 0,
            mod: 0,
        };
        skill = {
            ...defaultSkill,
            ...skill,
        };

        const id = randomID(16);
        const value = {};
        value[id] = skill;
        const fieldName = `data.skills.knowledge.${category}.value`;
        const updateData = {};
        updateData[fieldName] = value;
        this.update(updateData);
    }

    removeLanguageSkill(skillId) {
        const value = {};
        value[skillId] = { _delete: true };
        this.update({ 'data.skills.language.value': value });
    }

    addLanguageSkill(skill) {
        const defaultSkill = {
            name: '',
            specs: [],
            base: 0,
            value: 0,
            mod: 0,
        };
        skill = {
            ...defaultSkill,
            ...skill,
        };

        const id = randomID(16);
        const value = {};
        value[id] = skill;
        const fieldName = `data.skills.language.value`;
        const updateData = {};
        updateData[fieldName] = value;
        this.update(updateData);
    }

    removeKnowledgeSkill(skillId, category) {
        const value = {};
        const updateData = {};

        const dataString = `data.skills.knowledge.${category}.value`;
        value[skillId] = { _delete: true };
        updateData[dataString] = value;

        this.update(updateData);
    }

    rollFade(options: ActorRollOptions = {}, incoming = -1) {
        const wil = this.data.data.attributes.willpower;
        const res = this.data.data.attributes.resonance;
        const data = this.data.data;

        const parts = new PartsList<number>();
        parts.addUniquePart(wil.label, wil.value);
        parts.addUniquePart(res.label, res.value);
        if (data.modifiers.fade) parts.addUniquePart('SR5.Bonus', data.modifiers.fade);

        let title = `${game.i18n.localize('SR5.Resist')} ${game.i18n.localize('SR5.Fade')}`;
        const incomingDrain = {
            label: 'SR5.Fade',
            value: incoming,
        };
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            parts: parts.list,
            actor: this,
            title: title,
            wounds: false,
            incomingDrain,
        });
    }

    rollDrain(options: ActorRollOptions = {}, incoming = -1) {
        const wil = this.data.data.attributes.willpower;
        const drainAtt = this.data.data.attributes[this.data.data.magic.attribute];

        const parts = new PartsList<number>();
        parts.addPart(wil.label, wil.value);
        parts.addPart(drainAtt.label, drainAtt.value);
        if (this.data.data.modifiers.drain) parts.addUniquePart('SR5.Bonus', this.data.data.modifiers.drain);

        let title = `${game.i18n.localize('SR5.Resist')} ${game.i18n.localize('SR5.Drain')}`;
        const incomingDrain = {
            label: 'SR5.Drain',
            value: incoming,
        };
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            parts: parts.list,
            actor: this,
            title: title,
            wounds: false,
            incomingDrain,
        });
    }

    rollArmor(options: ActorRollOptions = {}, partsProps: ModList<number> = []) {
        const parts = new PartsList(partsProps);
        this._addArmorParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            actor: this,
            parts: parts.list,
            title: game.i18n.localize('SR5.Armor'),
            wounds: false,
        });
    }

    rollDefense(options: DefenseRollOptions = {}, partsProps: ModList<number> = []) {
        const parts = new PartsList(partsProps)
        this._addDefenseParts(parts);
        // full defense is always added
        const activeDefenses = {
            full_defense: {
                label: 'SR5.FullDefense',
                value: this.getFullDefenseAttribute()?.value,
                initMod: -10,
            },
        };
        // if we have a melee attack
        if (options.incomingAttack?.reach) {
            activeDefenses['dodge'] = {
                label: 'SR5.Dodge',
                value: this.findActiveSkill('gymnastics')?.value,
                initMod: -5,
            };
            activeDefenses['block'] = {
                label: 'SR5.Block',
                value: this.findActiveSkill('unarmed_combat')?.value,
                initMod: -5,
            };
            const equippedMeleeWeapons = this.getEquippedWeapons().filter((w) => w.isMeleeWeapon());
            let defenseReach = 0;
            equippedMeleeWeapons.forEach((weapon) => {
                activeDefenses[`parry-${weapon.name}`] = {
                    label: 'SR5.Parry',
                    weapon: weapon.name,
                    value: this.findActiveSkill(weapon.getActionSkill())?.value,
                    init: -5,
                };
                defenseReach = Math.max(defenseReach, weapon.getReach());
            });
            const incomingReach = options.incomingAttack.reach;
            const netReach = defenseReach - incomingReach;
            if (netReach !== 0) {
                parts.addUniquePart('SR5.Reach', netReach);
            }
        }
        let dialogData = {
            parts: parts.getMessageOutput(),
            cover: options.cover,
            activeDefenses,
        };
        let template = 'systems/shadowrun5e/dist/templates/rolls/roll-defense.html';
        let cancel = true;
        const incomingAttack = options.incomingAttack;
        const event = options.event;
        return new Promise((resolve) => {
            renderTemplate(template, dialogData).then((dlg) => {
                new Dialog({
                    title: game.i18n.localize('SR5.Defense'),
                    content: dlg,
                    buttons: {
                        continue: {
                            label: game.i18n.localize('SR5.Continue'),
                            callback: () => (cancel = false),
                        },
                    },
                    default: 'normal',
                    close: async (html) => {
                        if (cancel) return;
                        let cover = Helpers.parseInputToNumber($(html).find('[name=cover]').val());
                        let special = Helpers.parseInputToString($(html).find('[name=activeDefense]').val());
                        if (special) {
                            // TODO subtract initiative score when Foundry updates to 0.7.0
                            const defense = activeDefenses[special];
                            parts.addUniquePart(defense.label, defense.value);
                        }
                        if (cover) parts.addUniquePart('SR5.Cover', cover);

                        resolve(
                            ShadowrunRoller.advancedRoll({
                                event: event,
                                actor: this,
                                parts: parts.list,
                                title: game.i18n.localize('SR5.DefenseTest'),
                                incomingAttack,
                            }).then(async (roll: Roll | undefined) => {
                                if (incomingAttack && roll) {
                                    let defenderHits = roll.total;
                                    let attackerHits = incomingAttack.hits || 0;
                                    let netHits = attackerHits - defenderHits;

                                    if (netHits >= 0) {
                                        const damage = incomingAttack.damage;
                                        PartsList.AddUniquePart(damage.mod, 'SR5.NetHits', netHits);
                                        damage.value = Helpers.calcTotal(damage);

                                        const soakRollOptions = {
                                            event: event,
                                            damage: incomingAttack.damage,
                                        };
                                        await this.rollSoak(soakRollOptions);
                                    }
                                }
                            }),
                        );
                    },
                }).render(true);
            });
        });
    }

    rollSoak(options?: SoakRollOptions, partsProps: ModList<number> = []) {
        const parts = new PartsList(partsProps);
        this._addSoakParts(parts);
        let dialogData = {
            damage: options?.damage,
            parts: parts.getMessageOutput(),
            elementTypes: CONFIG.SR5.elementTypes,
        };
        let id = '';
        let cancel = true;
        let template = 'systems/shadowrun5e/dist/templates/rolls/roll-soak.html';
        return new Promise((resolve) => {
            renderTemplate(template, dialogData).then((dlg) => {
                new Dialog({
                    title: 'SR5.DamageResistanceTest',
                    content: dlg,
                    buttons: {
                        continue: {
                            label: game.i18n.localize('SR5.Continue'),
                            callback: () => {
                                id = 'default';
                                cancel = false;
                            },
                        },
                    },
                    close: async (html) => {
                        if (cancel) return;

                        const armor = this.getArmor();
                        const armorId = Helpers.parseInputToString($(html).find('[name=element]').val());

                        const bonusArmor = armor[armorId] || 0;
                        if (bonusArmor) parts.addUniquePart(CONFIG.SR5.elementTypes[armorId], bonusArmor);

                        const ap = Helpers.parseInputToNumber($(html).find('[name=ap]').val());
                        if (ap) {
                            let armorVal = armor.value + bonusArmor;

                            // don't take more AP than armor
                            parts.addUniquePart('SR5.AP', Math.max(ap, -armorVal));
                        }

                        let title = game.i18n.localize('SR5.SoakTest');
                        resolve(
                            ShadowrunRoller.advancedRoll({
                                event: options?.event,
                                actor: this,
                                soak: options?.damage,
                                parts: parts.list,
                                title: title,
                                wounds: false,
                            }),
                        );
                    },
                }).render(true);
            });
        });
    }

    rollSingleAttribute(attId, options: ActorRollOptions) {
        const attr = this.data.data.attributes[attId];
        const parts = new PartsList<number>();
        parts.addUniquePart(attr.label, attr.value);
        this._addMatrixParts(parts, attr);
        this._addGlobalParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts: parts.list,
            title: Helpers.label(attId),
        });
    }

    rollTwoAttributes([id1, id2], options: ActorRollOptions) {
        const attr1 = this.data.data.attributes[id1];
        const attr2 = this.data.data.attributes[id2];
        const label1 = Helpers.label(id1);
        const label2 = Helpers.label(id2);
        const parts = new PartsList<number>();
        parts.addPart(attr1.label, attr1.value);
        parts.addPart(attr2.label, attr2.value);
        this._addMatrixParts(parts, [attr1, attr2]);
        this._addGlobalParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts: parts.list,
            title: `${label1} + ${label2}`,
        });
    }

    rollNaturalRecovery(track, options?: ActorRollOptions) {
        let id1 = 'body';
        let id2 = 'willpower';
        let title = 'Natural Recover';
        if (track === 'physical') {
            id2 = 'body';
            title += ' - Physical - 1 Day';
        } else {
            title += ' - Stun - 1 Hour';
        }
        let att1 = this.data.data.attributes[id1];
        let att2 = this.data.data.attributes[id2];
        const parts = new PartsList<number>();
        parts.addPart(att1.label, att1.value);
        parts.addPart(att2.label, att2.value);

        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts: parts.list,
            title: title,
            extended: true,
            after: async (roll: Roll | undefined) => {
                if (!roll) return;
                let hits = roll.total;
                let current = this.data.data.track[track].value;

                current = Math.max(current - hits, 0);

                let key = `data.track.${track}.value`;

                let u = {};
                u[key] = current;
                await this.update(u);
            },
        });
    }

    async rollMatrixAttribute(attr, options?: ActorRollOptions) {
        let matrix_att = this.data.data.matrix[attr];
        let title = game.i18n.localize(CONFIG.SR5.matrixAttributes[attr]);
        const parts = new PartsList<number>();
        parts.addPart(CONFIG.SR5.matrixAttributes[attr], matrix_att.value);

        if (options && options.event && options.event[CONFIG.SR5.kbmod.SPEC]) parts.addUniquePart('SR5.Specialization', 2);
        if (Helpers.hasModifiers(options?.event)) {
            return ShadowrunRoller.advancedRoll({
                event: options?.event,
                actor: this,
                parts: parts.list,
                title: title,
            });
        }
        const attributes = Helpers.filter(this.data.data.attributes, ([, value]) => value.value > 0);
        const attribute = 'willpower';

        let dialogData = {
            attribute: attribute,
            attributes: attributes,
        };
        const buttons = {
            roll: {
                label: 'Continue',
                callback: () => (cancel = false),
            },
        };

        let cancel = true;
        renderTemplate('systems/shadowrun5e/dist/templates/rolls/matrix-roll.html', dialogData).then((dlg) => {
            new Dialog({
                title: `${title} Test`,
                content: dlg,
                buttons: buttons,
                close: async (html) => {
                    if (cancel) return;
                    const newAtt = Helpers.parseInputToString($(html).find('[name=attribute]').val());
                    let att: AttributeField | undefined = undefined;
                    if (newAtt) {
                        att = this.data.data.attributes[newAtt];
                        title += ` + ${game.i18n.localize(CONFIG.SR5.attributes[newAtt])}`;
                    }
                    if (att !== undefined) {
                        if (att.value && att.label) parts.addPart(att.label, att.value);
                        this._addMatrixParts(parts, true);
                        this._addGlobalParts(parts);
                        return ShadowrunRoller.advancedRoll({
                            event: options?.event,
                            actor: this,
                            parts: parts.list,
                            title: title,
                        });
                    }
                },
            }).render(true);
        });
    }

    promptRoll(options?: ActorRollOptions) {
        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            title: 'Roll',
            parts: [],
            actor: this,
            dialogOptions: {
                prompt: true,
            },
        });
    }

    rollAttributesTest(rollId, options?: ActorRollOptions) {
        const title = game.i18n.localize(CONFIG.SR5.attributeRolls[rollId]);
        const atts = this.data.data.attributes;
        const modifiers = this.data.data.modifiers;
        const parts = new PartsList<number>();
        if (rollId === 'composure') {
            parts.addUniquePart(atts.charisma.label, atts.charisma.value);
            parts.addUniquePart(atts.willpower.label, atts.willpower.value);
            if (modifiers.composure) parts.addUniquePart('SR5.Bonus', modifiers.composure);
        } else if (rollId === 'judge_intentions') {
            parts.addUniquePart(atts.charisma.label, atts.charisma.value);
            parts.addUniquePart(atts.intuition.label, atts.intuition.value);
            if (modifiers.judge_intentions) parts.addUniquePart('SR5.Bonus', modifiers.judge_intentions);
        } else if (rollId === 'lift_carry') {
            parts.addUniquePart(atts.strength.label, atts.strength.value);
            parts.addUniquePart(atts.body.label, atts.body.value);
            if (modifiers.lift_carry) parts.addUniquePart('SR5.Bonus', modifiers.lift_carry);
        } else if (rollId === 'memory') {
            parts.addUniquePart(atts.willpower.label, atts.willpower.value);
            parts.addUniquePart(atts.logic.label, atts.logic.value);
            if (modifiers.memory) parts.addUniquePart('SR5.Bonus', modifiers.memory);
        }

        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts: parts.list,
            title: `${title} Test`,
        });
    }

    rollSkill(skill, options?: SkillRollOptions) {
        let att = this.data.data.attributes[skill.attribute];
        let title = skill.label;

        if (options?.attribute) att = this.data.data.attributes[options.attribute];
        let limit = this.data.data.limits[att.limit];
        const parts = new PartsList<number>();
        parts.addUniquePart(skill.label, skill.value);

        if (options?.event && Helpers.hasModifiers(options?.event)) {
            parts.addUniquePart(att.label, att.value);
            if (options.event[CONFIG.SR5.kbmod.SPEC]) parts.addUniquePart('SR5.Specialization', 2);

            this._addMatrixParts(parts, [att, skill]);
            this._addGlobalParts(parts);
            return ShadowrunRoller.advancedRoll({
                event: options.event,
                actor: this,
                parts: parts.list,
                limit,
                title: `${title} Test`,
            });
        }
        let dialogData = {
            attribute: skill.attribute,
            attributes: Helpers.filter(this.data.data.attributes, ([, value]) => value.value > 0),
            limit: att.limit,
            limits: this.data.data.limits,
        };
        let cancel = true;
        let spec = '';

        let buttons = {
            roll: {
                label: 'Normal',
                callback: () => (cancel = false),
            },
        };
        // add specializations to dialog as buttons
        if (skill.specs?.length) {
            skill.specs.forEach(
                (s) =>
                    (buttons[s] = {
                        label: s,
                        callback: () => {
                            cancel = false;
                            spec = s;
                        },
                    }),
            );
        }
        renderTemplate('systems/shadowrun5e/dist/templates/rolls/skill-roll.html', dialogData).then((dlg) => {
            new Dialog({
                title: `${title} Test`,
                content: dlg,
                buttons,
                close: async (html) => {
                    if (cancel) return;
                    const newAtt = Helpers.parseInputToString($(html).find('[name="attribute"]').val());
                    const newLimit = Helpers.parseInputToString($(html).find('[name="attribute.limit"]').val());
                    att = this.data.data.attributes[newAtt];
                    title += ` + ${game.i18n.localize(CONFIG.SR5.attributes[newAtt])}`;
                    limit = this.data.data.limits[newLimit];
                    parts.addUniquePart(att.label, att.value);
                    if (skill.value === 0) parts.addUniquePart('SR5.Defaulting', -1);
                    if (spec) parts.addUniquePart('SR5.Specialization', 2);
                    this._addMatrixParts(parts, [att, skill]);
                    this._addGlobalParts(parts);
                    return ShadowrunRoller.advancedRoll({
                        event: options?.event,
                        actor: this,
                        parts: parts.list,
                        limit,
                        title: `${title} Test`,
                    });
                },
            }).render(true);
        });
    }

    rollKnowledgeSkill(catId, skillId, options?: SkillRollOptions) {
        const category = this.data.data.skills.knowledge[catId];
        const skill = duplicate(category.value[skillId]);
        skill.attribute = category.attribute;
        skill.label = skill.name;
        return this.rollSkill(skill, options);
    }

    rollLanguageSkill(skillId, options?: SkillRollOptions) {
        const skill = duplicate(this.data.data.skills.language.value[skillId]);
        skill.attribute = 'intuition';
        skill.label = skill.name;
        return this.rollSkill(skill, options);
    }

    rollActiveSkill(skillId, options?: SkillRollOptions) {
        const skill = this.data.data.skills.active[skillId];
        skill.label = game.i18n.localize(CONFIG.SR5.activeSkills[skillId]);
        return this.rollSkill(skill, options);
    }

    rollAttribute(attId, options?: ActorRollOptions) {
        let title = game.i18n.localize(CONFIG.SR5.attributes[attId]);
        const att = this.data.data.attributes[attId];
        const atts = this.data.data.attributes;
        const parts = new PartsList<number>();
        parts.addUniquePart(att.label, att.label === 'SR5.AttrEdge' ? this.getEdge().max : att.value);
        let dialogData = {
            attribute: att,
            attributes: atts,
        };
        let cancel = true;
        renderTemplate('systems/shadowrun5e/dist/templates/rolls/single-attribute.html', dialogData).then((dlg) => {
            new Dialog({
                title: `${title} Attribute Test`,
                content: dlg,
                buttons: {
                    roll: {
                        label: 'Continue',
                        callback: () => (cancel = false),
                    },
                },
                default: 'roll',
                close: async (html) => {
                    if (cancel) return;

                    const att2Id: string = Helpers.parseInputToString($(html).find('[name=attribute2]').val());
                    let att2: AttributeField | undefined = undefined;
                    if (att2Id !== 'none') {
                        att2 = atts[att2Id];
                        if (att2?.label) {
                            parts.addUniquePart(att2.label, att2.label === 'SR5.AttrEdge' ? this.getEdge().max : att2.value);
                            const att2IdLabel = game.i18n.localize(CONFIG.SR5.attributes[att2Id]);
                            title += ` + ${att2IdLabel}`;
                        }
                    }
                    if (att2Id === 'default') {
                        parts.addUniquePart('SR5.Defaulting', -1);
                    }
                    this._addMatrixParts(parts, [att, att2]);
                    this._addGlobalParts(parts);
                    return ShadowrunRoller.advancedRoll({
                        event: options?.event,
                        title: `${title} Test`,
                        actor: this,
                        parts: parts.list,
                    });
                },
            }).render(true);
        });
    }

    _addMatrixParts(parts: PartsList<number>, atts) {
        if (Helpers.isMatrix(atts)) {
            const m = this.data.data.matrix;
            if (m.hot_sim) parts.addUniquePart('SR5.HotSim', 2);
            if (m.running_silent) parts.addUniquePart('SR5.RunningSilent', -2);
        }
    }
    _addGlobalParts(parts: PartsList<number>) {
        if (this.data.data.modifiers.global) {
            parts.addUniquePart('SR5.Global', this.data.data.modifiers.global);
        }
    }

    _addDefenseParts(parts: PartsList<number>) {
        const reaction = this.findAttribute('reaction');
        const intuition = this.findAttribute('intuition');
        const mod = this.getModifier('defense');

        if (reaction) {
            parts.addUniquePart(reaction.label || 'SR5.Reaction', reaction.value);
        }
        if (intuition) {
            parts.addUniquePart(intuition.label || 'SR5.Intuition', intuition.value);
        }
        if (mod) {
            parts.addUniquePart('SR5.Bonus', mod);
        }
    }

    _addArmorParts(parts: PartsList<number>) {
        const armor = this.getArmor();
        if (armor) {
            parts.addUniquePart(armor.label || 'SR5.Armor', armor.base);
            for (let part of armor.mod) {
                parts.addUniquePart(part.name, part.value);
            }
        }
    }

    _addSoakParts(parts: PartsList<number>) {
        const body = this.findAttribute('body');
        if (body) {
            parts.addUniquePart(body.label || 'SR5.Body', body.value);
        }
        this._addArmorParts(parts);
    }

    static async pushTheLimit(li) {
        let msg: ChatMessage = game.messages.get(li.data().messageId);

        if (msg.getFlag(SYSTEM_NAME, 'customRoll')) {
            let actor = (msg.user.character as unknown) as SR5Actor;
            if (!actor) {
                // get controlled tokens
                const tokens = canvas.tokens.controlled;
                if (tokens.length > 0) {
                    for (let token of tokens) {
                        if (token.actor.owner) {
                            actor = token.actor;
                            break;
                        }
                    }
                }
            }
            if (actor) {
                const parts = new PartsList<number>();
                parts.addUniquePart('SR5.PushTheLimit', actor.getEdge().max);
                ShadowrunRoller.basicRoll({
                    title: ` - ${game.i18n.localize('SR5.PushTheLimit')}`,
                    parts: parts.list,
                    actor: actor,
                }).then(() => {
                    actor.update({
                        'data.attributes.edge.value': actor.getEdge().value - 1,
                    });
                });
            } else {
                // @ts-ignore
                ui.notifications.warn(game.i18n.localize('SR5.SelectTokenMessage'));
            }
        }
    }

    static async secondChance(li) {
        let msg: ChatMessage = game.messages.get(li.data().messageId);
        // @ts-ignore
        let roll: Roll = JSON.parse(msg.data?.roll);
        let formula = roll.formula;
        let hits = roll.total;
        let re = /(\d+)d6/;
        let matches = formula.match(re);
        if (matches && matches[1]) {
            let match = matches[1];
            let pool = parseInt(match.replace('d6', ''));
            if (!isNaN(pool) && !isNaN(hits)) {
                let actor = (msg.user.character as unknown) as SR5Actor;
                if (!actor) {
                    // get controlled tokens
                    const tokens = canvas.tokens.controlled;
                    if (tokens.length > 0) {
                        for (let token of tokens) {
                            if (token.actor.owner) {
                                actor = token.actor;
                                break;
                            }
                        }
                    }
                }
                if (actor) {
                    const parts = new PartsList<number>();
                    parts.addUniquePart('SR5.OriginalDicePool', pool);
                    parts.addUniquePart('SR5.Successes', -hits);

                    return ShadowrunRoller.basicRoll({
                        title: ` - Second Chance`,
                        parts: parts.list,
                        actor: actor,
                    }).then(() => {
                        actor.update({
                            'data.attributes.edge.value': actor.getEdge().value - 1,
                        });
                    });
                } else {
                    // @ts-ignore
                    ui.notifications.warn(game.i18n.localize('SR5.SelectTokenMessage'));
                }
            }
        }
    }

    /**
     * Override setFlag to remove the 'SR5.' from keys in modlists, otherwise it handles them as embedded keys
     * @param scope
     * @param key
     * @param value
     */
    setFlag(scope: string, key: string, value: any): Promise<Entity> {
        const newValue = Helpers.onSetFlag(value);
        return super.setFlag(scope, key, newValue);
    }

    /**
     * Override getFlag to add back the 'SR5.' keys correctly to be handled
     * @param scope
     * @param key
     */
    getFlag(scope: string, key: string): any {
        const data = super.getFlag(scope, key);
        return Helpers.onGetFlag(data);
    }
}
