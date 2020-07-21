import { ShadowrunRoller } from '../rolls/ShadowrunRoller';
import { Helpers } from '../helpers';
import { SR5Item } from '../item/SR5Item';
import Attributes = Shadowrun.Attributes;
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
import SR5ActorData = Shadowrun.SR5ActorData;
import { SR5ItemDataWrapper } from '../item/SR5ItemDataWrapper';

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

    /**
     * Prepare Matrix data on the actor
     * - if an item is equipped, it will use that data
     * - if it isn't and player is technomancer, it will use that data
     * @param data
     * @param items
     */
    private static prepareMatrix(data: SR5ActorData, items: SR5ItemDataWrapper[]) {
        const { matrix, attributes, limits } = data;

        // clear matrix data to defaults
        matrix.firewall.value = Helpers.totalMods(matrix.firewall.mod);
        matrix.data_processing.value = Helpers.totalMods(matrix.data_processing.mod);
        matrix.attack.value = Helpers.totalMods(matrix.attack.mod);
        matrix.sleaze.value = Helpers.totalMods(matrix.sleaze.mod);
        matrix.condition_monitor.max = 0;
        matrix.rating = 0;
        matrix.name = '';
        matrix.device = '';

        // get the first equipped device, we don't care if they have more equipped -- it shouldn't happen
        const device = items.find((item) => item.isEquipped() && item.isDevice());

        if (device) {
            const conditionMonitor = device.getConditionMonitor();
            matrix.device = device.getId();
            matrix.condition_monitor.max = conditionMonitor.max;
            matrix.condition_monitor.value = conditionMonitor.value;
            matrix.rating = device.getRating();
            matrix.is_cyberdeck = device.isCyberdeck();
            matrix.name = device.getName();
            matrix.item = device.getData();
            const deviceAtts = device.getASDF();
            if (deviceAtts) {
                // setup the actual matrix attributes for the actor
                for (const [key, value] of Object.entries(deviceAtts)) {
                    if (value && matrix[key]) {
                        matrix[key].value += value.value;
                        matrix[key].device_att = value.device_att;
                    }
                }
            }
        } // if we don't have a device, use living persona
        else if (data.special === 'resonance') {
            matrix.firewall.value += Helpers.calcTotal(attributes.willpower);
            matrix.data_processing.value += Helpers.calcTotal(attributes.logic);
            matrix.rating = Helpers.calcTotal(attributes.resonance);
            matrix.attack.value += Helpers.calcTotal(attributes.charisma);
            matrix.sleaze.value += Helpers.calcTotal(attributes.intuition);
            matrix.name = game.i18n.localize('SR5.LivingPersona');
        }

        // set matrix condition monitor to max if greater than
        if (matrix.condition_monitor.value > matrix.condition_monitor.max) {
            matrix.condition_monitor.value = matrix.condition_monitor.max;
        }

        // add matrix attributes to both limits and attributes as hidden entries
        ['firewall', 'sleaze', 'data_processing', 'firewall'].forEach((key) => {
            if (matrix[key]) {
                const label = CONFIG.SR5.matrixAttributes[key];
                const { value, base, mod } = matrix[key];
                const hidden = true;

                limits[key] = {
                    value,
                    base,
                    mod,
                    label,
                    hidden,
                };
                attributes[key] = {
                    value,
                    base,
                    mod,
                    label,
                    hidden,
                };
            }
        });
    }

    /**
     * Prepare the armor data for the Item
     * - will only allow one "Base" armor item to be used
     * - all "accessories" will be added to the armor
     * @param data
     * @param items
     */
    private static prepareArmor(data: SR5ActorData, items: SR5ItemDataWrapper[]) {
        const { armor } = data;
        armor.base = 0;
        armor.value = 0;
        armor.mod = {};
        for (const element of Object.keys(CONFIG.SR5.elementTypes)) {
            armor[element] = 0;
        }

        const equippedArmor = items.filter((item) => item.isArmor() && item.isEquipped());
        equippedArmor?.forEach((item) => {
            if (item.isArmorAccessory()) {
                armor.mod[item.getName()] = item.getArmorValue();
            } // if not a mod, set armor.value to the items value
            else {
                armor.base = item.getArmorValue();
                armor.label = item.getName();
                for (const element of Object.keys(CONFIG.SR5.elementTypes)) {
                    armor[element] = item.getArmorElements()[element];
                }
            }
        });

        if (data.modifiers['armor']) armor.mod[game.i18n.localize('SR5.Bonus')] = data.modifiers['armor'];
        // SET ARMOR
        armor.value = armor.base + Helpers.totalMods(armor.mod);
    }

    /**
     * Prepare actor data for cyberware changes
     * - this calculates the actors essence
     * @param data
     * @param items
     */
    private static prepareCyberware(data: SR5ActorData, items: SR5ItemDataWrapper[]) {
        const { attributes } = data;
        let totalEssence = 6;
        items
            .filter((item) => item.isCyberware() && item.isEquipped())
            .forEach((item) => {
                if (item.getEssenceLoss()) {
                    totalEssence -= item.getEssenceLoss();
                }
            });
        attributes.essence.value = +(totalEssence + Number(data.modifiers['essence'])).toFixed(3);
    }

    /**
     * Prepare actor data for attributes
     * @param data
     */
    private static prepareAttributes(data: SR5ActorData) {
        const { attributes } = data;

        // set the value for the attributes
        for (let [key, attribute] of Object.entries(attributes)) {
            Helpers.calcTotal(attribute);
            // add labels
            attribute.label = CONFIG.SR5.attributes[key];
        }
    }

    /**
     * Prepare actor data for skills
     * @param data
     */
    private static prepareSkills(data: SR5ActorData) {
        const { language, active, knowledge } = data.skills;
        if (language) {
            if (!language.value) language.value = {};
            language.attribute = 'intuition';
        }

        // function that will set the total of a skill correctly
        const prepareSkill = (skill) => {
            skill.mod = {};
            if (!skill.base) skill.base = 0;
            if (skill.bonus?.length) {
                for (let bonus of skill.bonus) {
                    skill.mod[bonus.key] = bonus.value;
                }
            }
            Helpers.calcTotal(skill);
        };

        // setup active skills
        for (const skill of Object.values(active)) {
            if (!skill.hidden) {
                prepareSkill(skill);
            }
        }

        const entries = Object.entries(data.skills.language.value);
        // remove entries which are deleted TODO figure out how to delete these from the data
        entries.forEach(([key, val]: [string, { _delete?: boolean }]) => val._delete && delete data.skills.language.value[key]);

        for (let skill of Object.values(language.value)) {
            prepareSkill(skill);
            skill.attribute = 'intuition';
        }

        // setup knowledge skills
        for (let [, group] of Object.entries(knowledge)) {
            const entries = Object.entries(group.value);
            // remove entries which are deleted TODO figure out how to delete these from the data
            group.value = entries
                .filter(([, val]) => !val._delete)
                .reduce((acc, [id, skill]) => {
                    prepareSkill(skill);

                    // set the attribute on the skill
                    skill.attribute = group.attribute;
                    acc[id] = skill;
                    return acc;
                }, {});
        }

        // skill labels
        for (let [skillKey, skillValue] of Object.entries(active)) {
            skillValue.label = CONFIG.SR5.activeSkills[skillKey];
        }
    }

    /**
     * Prepare the actor data limits
     * @param data
     */
    private static prepareLimits(data: SR5ActorData) {
        const { limits, attributes, modifiers } = data;

        // SETUP LIMITS
        limits.physical.value =
            Math.ceil((2 * attributes.strength.value + attributes.body.value + attributes.reaction.value) / 3) + Number(modifiers['physical_limit']);
        limits.mental.value =
            Math.ceil((2 * attributes.logic.value + attributes.intuition.value + attributes.willpower.value) / 3) + Number(modifiers['mental_limit']);
        limits.social.value =
            Math.ceil((2 * attributes.charisma.value + attributes.willpower.value + attributes.essence.value) / 3) + Number(modifiers['social_limit']);

        // limit labels
        for (let [limitKey, limitValue] of Object.entries(limits)) {
            limitValue.label = CONFIG.SR5.limits[limitKey];
        }
    }

    /**
     * Prepare actor data condition monitors (aka Tracks)
     * @param data
     */
    private static prepareConditionMonitors(data: SR5ActorData) {
        const { track, attributes, modifiers } = data;

        // TODO we will have grunts eventually that only have one track
        track.physical.max = 8 + Math.ceil(attributes.body.value / 2) + Number(modifiers['physical_track']);
        track.physical.overflow.max = attributes.body.value;
        track.stun.max = 8 + Math.ceil(attributes.willpower.value / 2) + Number(modifiers['stun_track']);

        // tracks
        for (let [trackKey, trackValue] of Object.entries(track)) {
            trackValue.label = CONFIG.SR5.damageTypes[trackKey];
        }
    }

    /**
     * Prepare actor data movement
     * @param data
     */
    private static prepareMovement(data: SR5ActorData) {
        const { attributes, modifiers } = data;
        const movement = data.movement;
        // default movement: WALK = AGI * 2, RUN = AGI * 4
        movement.walk.value = attributes.agility.value * (2 + Number(modifiers['walk']));
        movement.run.value = attributes.agility.value * (4 + Number(modifiers['run']));
    }

    /**
     * Prepare the modifiers that are displayed in the Misc. tab
     * @param data
     */
    private static prepareModifiers(data: SR5ActorData) {
        if (!data.modifiers) data.modifiers = {};
        const modifiers = {};
        let miscTabModifiers = [
            'soak',
            'drain',
            'armor',
            'physical_limit',
            'social_limit',
            'mental_limit',
            'stun_track',
            'physical_track',
            'meat_initiative',
            'meat_initiative_dice',
            'astral_initiative',
            'astral_initiative_dice',
            'matrix_initiative',
            'matrix_initiative_dice',
            'composure',
            'lift_carry',
            'judge_intentions',
            'memory',
            'walk',
            'run',
            'defense',
            'wound_tolerance',
            'essence',
            'fade',
        ];
        miscTabModifiers.sort();
        // force global to the top
        miscTabModifiers.unshift('global');

        for (let item of miscTabModifiers) {
            modifiers[item] = Number(data.modifiers[item]) || 0;
        }

        data.modifiers = modifiers;
    }

    /**
     * Prepare actor data for initiative
     * @param data
     */
    private static prepareInitiative(data: SR5ActorData) {
        const { initiative, attributes, modifiers, matrix } = data;
        initiative.meatspace.base.base = attributes.intuition.value + attributes.reaction.value + Number(modifiers['meat_initiative']);
        initiative.meatspace.dice.base = 1 + Number(modifiers['meat_initiative_dice']);
        initiative.astral.base.base = attributes.intuition.value * 2 + Number(modifiers['astral_initiative']);
        initiative.astral.dice.base = 2 + Number(modifiers['astral_initiative_dice']);
        initiative.matrix.base.base = attributes.intuition.value + data.matrix.data_processing.value + Number(modifiers['matrix_initiative']);
        initiative.matrix.dice.base = matrix.hot_sim ? 4 : 3 + Number(modifiers['matrix_initiative_dice']);
        if (initiative.perception === 'matrix') initiative.current = initiative.matrix;
        else if (initiative.perception === 'astral') initiative.current = initiative.astral;
        else {
            initiative.current = initiative.meatspace;
            initiative.perception = 'meatspace';
        }
        initiative.current.dice.value = initiative.current.dice.base;
        if (initiative.edge) initiative.current.dice.value = 5;
        initiative.current.dice.value = Math.min(5, initiative.current.dice.value); // maximum of 5d6 for initiative
        initiative.current.dice.text = `${initiative.current.dice.value}d6`;
        initiative.current.base.value = initiative.current.base.base;
    }

    /**
     * Prepare actor data for wounds
     * @param data
     */
    private static prepareWounds(data: SR5ActorData) {
        const { modifiers, track } = data;
        const count = 3 + Number(modifiers['wound_tolerance']);
        const stunWounds = Math.floor(data.track.stun.value / count);
        const physicalWounds = Math.floor(data.track.physical.value / count);

        track.stun.wounds = stunWounds;
        track.physical.wounds = physicalWounds;

        data.wounds = {
            value: stunWounds + physicalWounds,
        };
    }

    prepareData() {
        super.prepareData();

        const actorData = this.data;
        // @ts-ignore
        const items: SR5ItemDataWrapper[] = actorData.items.map((item) => new SR5ItemDataWrapper(item));
        const data = actorData.data;
        const { attributes }: { attributes: Attributes } = data;

        attributes.magic.hidden = !(data.special === 'magic');
        attributes.resonance.hidden = !(data.special === 'resonance');

        // PARSE WEAPONS AND SET VALUES AS NEEDED

        // modifiers must be handled first
        SR5Actor.prepareModifiers(data);
        // items preparations
        SR5Actor.prepareArmor(data, items);
        SR5Actor.prepareCyberware(data, items);
        SR5Actor.prepareSkills(data);
        SR5Actor.prepareAttributes(data);
        // matrix prep must happen after attributes
        SR5Actor.prepareMatrix(data, items);
        // limits prep must happen after attributes
        SR5Actor.prepareLimits(data);
        SR5Actor.prepareConditionMonitors(data);
        SR5Actor.prepareMovement(data);
        SR5Actor.prepareInitiative(data);
        SR5Actor.prepareWounds(data);

        // CALCULATE RECOIL
        data.recoil_compensation = 1 + Math.ceil(attributes.strength.value / 3);

        if (data.magic.drain && !data.magic.drain.mod) data.magic.drain.mod = {};
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

        const parts = {};
        parts[wil.label] = wil.value;
        parts[res.label] = res.value;
        if (data.modifiers.fade) parts['SR5.Bonus'] = data.modifiers.fade;

        let title = `${game.i18n.localize('SR5.Resist')} ${game.i18n.localize('SR5.Fade')}`;
        const incomingDrain = {
            label: 'SR5.Fade',
            value: incoming,
        };
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            parts,
            actor: this,
            title: title,
            wounds: false,
            incomingDrain,
        });
    }

    rollDrain(options: ActorRollOptions = {}, incoming = -1) {
        const wil = this.data.data.attributes.willpower;
        const drainAtt = this.data.data.attributes[this.data.data.magic.attribute];

        const parts = {};
        parts[wil.label] = wil.value;
        parts[drainAtt.label] = drainAtt.value;
        if (this.data.data.modifiers.drain) parts['SR5.Bonus'] = this.data.data.modifiers.drain;

        let title = `${game.i18n.localize('SR5.Resist')} ${game.i18n.localize('SR5.Drain')}`;
        const incomingDrain = {
            label: 'SR5.Drain',
            value: incoming,
        };
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            parts,
            actor: this,
            title: title,
            wounds: false,
            incomingDrain,
        });
    }

    rollArmor(options: ActorRollOptions = {}, parts: ModList<number> = {}) {
        this._addArmorParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options.event,
            actor: this,
            parts,
            title: game.i18n.localize('SR5.Armor'),
            wounds: false,
        });
    }

    rollDefense(options: DefenseRollOptions = {}, parts: ModList<number> = {}) {
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
                parts['SR5.Reach'] = netReach;
            }
        }
        let dialogData = {
            parts,
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
                            parts[defense.label] = defense.value;
                        }
                        if (cover) parts['SR5.Cover'] = cover;

                        resolve(
                            ShadowrunRoller.advancedRoll({
                                event: event,
                                actor: this,
                                parts,
                                title: game.i18n.localize('SR5.DefenseTest'),
                                incomingAttack,
                            }).then(async (roll: Roll | undefined) => {
                                if (incomingAttack && roll) {
                                    let defenderHits = roll.total;
                                    let attackerHits = incomingAttack.hits || 0;
                                    let netHits = attackerHits - defenderHits;

                                    if (netHits >= 0) {
                                        const damage = incomingAttack.damage;
                                        damage.mod['SR5.NetHits'] = netHits;
                                        damage.value = damage.base + Helpers.totalMods(damage.mod);

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

    rollSoak(options?: SoakRollOptions, parts: ModList<number> = {}) {
        this._addSoakParts(parts);
        let dialogData = {
            damage: options?.damage,
            parts,
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
                        if (bonusArmor) parts[CONFIG.SR5.elementTypes[armorId]] = bonusArmor;

                        const ap = Helpers.parseInputToNumber($(html).find('[name=ap]').val());
                        if (ap) {
                            let armorVal = armor.value + bonusArmor;

                            // don't take more AP than armor
                            parts['SR5.AP'] = Math.max(ap, -armorVal);
                        }

                        let title = game.i18n.localize('SR5.SoakTest');
                        resolve(
                            ShadowrunRoller.advancedRoll({
                                event: options?.event,
                                actor: this,
                                soak: options?.damage,
                                parts,
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
        const parts = {};
        parts[attr.label] = attr.value;
        this._addMatrixParts(parts, attr);
        this._addGlobalParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts,
            title: Helpers.label(attId),
        });
    }

    rollTwoAttributes([id1, id2], options: ActorRollOptions) {
        const attr1 = this.data.data.attributes[id1];
        const attr2 = this.data.data.attributes[id2];
        const label1 = Helpers.label(id1);
        const label2 = Helpers.label(id2);
        const parts = {};
        parts[attr1.label] = attr1.value;
        parts[attr2.label] = attr2.value;
        this._addMatrixParts(parts, [attr1, attr2]);
        this._addGlobalParts(parts);
        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts,
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
        const parts = {};
        parts[att1.label] = att1.value;
        parts[att2.label] = att2.value;

        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts,
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
        const parts = {};
        parts[CONFIG.SR5.matrixAttributes[attr]] = matrix_att.value;
        if (options && options.event && options.event[CONFIG.SR5.kbmod.SPEC]) parts['SR5.Specialization'] = 2;
        if (Helpers.hasModifiers(options?.event)) {
            return ShadowrunRoller.advancedRoll({
                event: options?.event,
                actor: this,
                parts,
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
                        if (att.value && att.label) parts[att.label] = att.value;
                        this._addMatrixParts(parts, true);
                        this._addGlobalParts(parts);
                        return ShadowrunRoller.advancedRoll({
                            event: options?.event,
                            actor: this,
                            parts,
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
            parts: {},
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
        const parts = {};
        if (rollId === 'composure') {
            parts[atts.charisma.label] = atts.charisma.value;
            parts[atts.willpower.label] = atts.willpower.value;
            if (modifiers.composure) parts['SR5.Bonus'] = modifiers.composure;
        } else if (rollId === 'judge_intentions') {
            parts[atts.charisma.label] = atts.charisma.value;
            parts[atts.intuition.label] = atts.intuition.value;
            if (modifiers.judge_intentions) parts['SR5.Bonus'] = modifiers.judge_intentions;
        } else if (rollId === 'lift_carry') {
            parts[atts.strength.label] = atts.strength.value;
            parts[atts.body.label] = atts.body.value;
            if (modifiers.lift_carry) parts['SR5.Bonus'] = modifiers.lift_carry;
        } else if (rollId === 'memory') {
            parts[atts.willpower.label] = atts.willpower.value;
            parts[atts.logic.label] = atts.logic.value;
            if (modifiers.memory) parts['SR5.Bonus'] = modifiers.memory;
        }

        return ShadowrunRoller.advancedRoll({
            event: options?.event,
            actor: this,
            parts,
            title: `${title} Test`,
        });
    }

    rollSkill(skill, options?: SkillRollOptions) {
        let att = this.data.data.attributes[skill.attribute];
        let title = skill.label;

        if (options?.attribute) att = this.data.data.attributes[options.attribute];
        let limit = this.data.data.limits[att.limit];
        const parts = {};
        parts[skill.label] = skill.value;

        if (options?.event && Helpers.hasModifiers(options?.event)) {
            parts[att.label] = att.value;
            if (options.event[CONFIG.SR5.kbmod.SPEC]) parts['SR5.Specialization'] = 2;

            this._addMatrixParts(parts, [att, skill]);
            this._addGlobalParts(parts);
            return ShadowrunRoller.advancedRoll({
                event: options.event,
                actor: this,
                parts,
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
                    parts[att.label] = att.value;
                    if (skill.value === 0) parts['SR5.Defaulting'] = -1;
                    if (spec) parts['SR5.Specialization'] = 2;
                    this._addMatrixParts(parts, [att, skill]);
                    this._addGlobalParts(parts);
                    return ShadowrunRoller.advancedRoll({
                        event: options?.event,
                        actor: this,
                        parts,
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
        const parts = {};
        parts[att.label] = att.label === 'SR5.AttrEdge' ? this.getEdge().max : att.value;
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
                            parts[att2.label] = att2.label === 'SR5.AttrEdge' ? this.getEdge().max : att2.value;
                            const att2IdLabel = game.i18n.localize(CONFIG.SR5.attributes[att2Id]);
                            title += ` + ${att2IdLabel}`;
                        }
                    }
                    if (att2Id === 'default') {
                        parts['SR5.Defaulting'] = -1;
                    }
                    this._addMatrixParts(parts, [att, att2]);
                    this._addGlobalParts(parts);
                    return ShadowrunRoller.advancedRoll({
                        event: options?.event,
                        title: `${title} Test`,
                        actor: this,
                        parts,
                    });
                },
            }).render(true);
        });
    }

    _addMatrixParts(parts, atts) {
        if (Helpers.isMatrix(atts)) {
            const m = this.data.data.matrix;
            if (m.hot_sim) parts['SR5.HotSim'] = 2;
            if (m.running_silent) parts['SR5.RunningSilent'] = -2;
        }
    }
    _addGlobalParts(parts) {
        if (this.data.data.modifiers.global) {
            parts['SR5.Global'] = this.data.data.modifiers.global;
        }
    }

    _addDefenseParts(parts) {
        const reaction = this.findAttribute('reaction');
        const intuition = this.findAttribute('intuition');
        const mod = this.getModifier('defense');

        if (reaction) {
            parts[reaction.label || 'SR5.Reaction'] = reaction.value;
        }
        if (intuition) {
            parts[intuition.label || 'SR5.Intuition'] = intuition.value;
        }
        if (mod) {
            parts['SR5.Bonus'] = mod;
        }
    }

    _addArmorParts(parts: ModList<number>) {
        const armor = this.getArmor();
        if (armor) {
            parts[armor.label || 'SR5.Armor'] = armor.base;
            for (let [key, val] of Object.entries(armor.mod)) {
                parts[key] = val;
            }
        }
    }

    _addSoakParts(parts: ModList<number>) {
        const body = this.findAttribute('body');
        if (body) {
            parts[body.label || 'SR5.Body'] = body.value;
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
                const parts = {};
                parts['SR5.PushTheLimit'] = actor.getEdge().max;
                ShadowrunRoller.basicRoll({
                    title: ` - ${game.i18n.localize('SR5.PushTheLimit')}`,
                    parts: parts,
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
                    const parts = {};
                    parts['SR5.OriginalDicePool'] = pool;
                    parts['SR5.Successes'] = -hits;

                    return ShadowrunRoller.basicRoll({
                        title: ` - Second Chance`,
                        parts,
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
