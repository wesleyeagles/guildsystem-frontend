import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

import {
  ITEM_CATEGORIES,
  WEAPON_TYPES,
  ARMOR_TYPES,
  ACCESSORY_TYPES,
  ITEM_RACES,
  WEAPON_GRADES,
  ARMOR_CLASSES,
  ITEM_ELEMENTS,
  type ItemDto,
  type ItemCategory,
  type ItemType,
  type ItemRace,
  type ItemElement,
} from '../../../../api/items.api';

import { CastSelectComponent } from '../cast-select.component';
import { ImagePickerComponent } from '../item-picker/image-picker.component';
import { UiSelectComponent, UiSelectOption } from '../ui-select/ui-select.component';

export type ItemModalResult = {
  mode: 'create' | 'edit';
  id?: number;
  payload: any;
  uploadFile?: File | null;
};

const SHIELD_GRADES = ['Normal', 'Rare A', 'Rare B', 'Rare C', 'Superior'] as const;
type ShieldGrade = (typeof SHIELD_GRADES)[number];

function strOrNull(v: any): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asOptions<T extends string>(arr: readonly T[]): UiSelectOption<T>[] {
  return (arr as readonly T[]).map((v) => ({ value: v, label: v }));
}

@Component({
  standalone: true,
  selector: 'app-item-modal',
  imports: [CommonModule, FormsModule, TranslocoPipe, CastSelectComponent, ImagePickerComponent, UiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './item-modal.component.scss',
  templateUrl: './item-modal.component.html',
})
export class ItemModalComponent {
  @Input() open = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() item: ItemDto | null = null;
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<ItemModalResult>();

  categories = ITEM_CATEGORIES;
  races = ITEM_RACES;
  armorClasses = ARMOR_CLASSES;
  elements = ITEM_ELEMENTS;

  categoryOptions = asOptions(ITEM_CATEGORIES);
  raceOptions = asOptions(ITEM_RACES);
  armorClassOptions = asOptions(ARMOR_CLASSES);

  uploadFile: File | null = null;

  form = {
    category: 'Weapon' as ItemCategory,
    name: '',
    imagePath: null as string | null,
    description: '' as any,

    // ✅ novo: quantity p/ Resource/Booty
    quantity: null as any,

    type: null as ItemType | null,

    race: null as ItemRace | null,
    level: null as any,
    grade: null as any,

    attackMin: null as any,
    attackMax: null as any,
    forceAttackMin: null as any,
    forceAttackMax: null as any,
    castId: null as any | null,

    armorClass: null as any,
    defense: null as any,
    defenseSuccessRate: null as any,

    elements: [] as ItemElement[],
    specialEffects: [] as string[],
    upgradeLevel: null as any,
  };

  ngOnChanges() {
    if (!this.open) return;

    this.uploadFile = null;

    if (this.mode === 'edit' && this.item) {
      this.form.category = this.item.category;

      this.form.name = this.item.name ?? '';
      this.form.imagePath = this.item.imagePath ?? null;
      this.form.description = this.item.description ?? '';

      this.form.quantity = (this.item as any).quantity ?? null;

      this.form.type = (this.item.type ?? null) as any;

      this.form.race = (this.item.race ?? null) as any;
      this.form.level = this.item.level ?? null;
      this.form.grade = this.item.grade ?? null;

      this.form.attackMin = this.item.attackMin ?? null;
      this.form.attackMax = this.item.attackMax ?? null;
      this.form.forceAttackMin = this.item.forceAttackMin ?? null;
      this.form.forceAttackMax = this.item.forceAttackMax ?? null;
      this.form.castId = this.item.castId ?? null;

      this.form.armorClass = this.item.armorClass ?? null;
      this.form.defense = this.item.defense ?? null;
      this.form.defenseSuccessRate = this.item.defenseSuccessRate ?? null;

      this.form.elements = Array.isArray(this.item.elements) ? (this.item.elements as any) : [];
      this.form.specialEffects = Array.isArray(this.item.specialEffects) ? this.item.specialEffects.slice() : [];
      this.form.upgradeLevel = this.item.upgradeLevel ?? null;
    }

    if (this.mode === 'create') this.resetCreateDefaults();
  }

  resetCreateDefaults() {
    this.form.category = 'Weapon';

    this.form.name = '';
    this.form.imagePath = null;
    this.form.description = '';

    // ✅ default (vai ser exigido só em Resource/Booty)
    this.form.quantity = 1;

    this.form.type = null;

    this.form.race = null;
    this.form.level = null;
    this.form.grade = null;

    this.form.attackMin = null;
    this.form.attackMax = null;
    this.form.forceAttackMin = null;
    this.form.forceAttackMax = null;
    this.form.castId = null;

    this.form.armorClass = null;
    this.form.defense = null;
    this.form.defenseSuccessRate = null;

    this.form.elements = [];
    this.form.specialEffects = [];
    this.form.upgradeLevel = null;
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (!this.open || this.saving) return;
    this.close.emit();
  }

  onPickedImagePath(path: string | null) {
    this.form.imagePath = path;
    this.uploadFile = null;
  }

  onPickedImageFile(file: File) {
    this.uploadFile = file;

    // ✅ IMPORTANTÍSSIMO: se veio Upload, não pode ficar com path antigo da biblioteca
    this.form.imagePath = null;
  }

  onCategoryPicked(cat: ItemCategory | null) {
    if (!cat) return;
    this.form.category = cat;
    this.onCategoryChange();
  }

  onCategoryChange() {
    const c = this.form.category;

    // ✅ quantity só pra Resource/Booty
    if (c !== 'Resource' && c !== 'Booty') this.form.quantity = null;
    else this.form.quantity = numOrNull(this.form.quantity) ?? 1;

    if (c === 'Resource' || c === 'Booty') {
      this.form.type = null;
      this.form.race = null;
      this.form.level = null;
      this.form.grade = null;

      this.form.attackMin = null;
      this.form.attackMax = null;
      this.form.forceAttackMin = null;
      this.form.forceAttackMax = null;
      this.form.castId = null;

      this.form.armorClass = null;
      this.form.defense = null;
      this.form.defenseSuccessRate = null;

      this.form.elements = [];
      this.form.specialEffects = [];
      this.form.upgradeLevel = null;
      return;
    }

    if (c === 'Accessory') {
      this.form.attackMin = null;
      this.form.attackMax = null;
      this.form.forceAttackMin = null;
      this.form.forceAttackMax = null;
      this.form.castId = null;

      this.form.armorClass = null;
      this.form.defense = null;
      this.form.defenseSuccessRate = null;

      this.form.upgradeLevel = null;
      this.form.grade = null;
      return;
    }

    if (c === 'Armor') {
      this.form.attackMin = null;
      this.form.attackMax = null;
      this.form.forceAttackMin = null;
      this.form.forceAttackMax = null;
      this.form.castId = null;

      this.form.elements = [];
      return;
    }

    if (c === 'Shield') {
      this.form.type = null;

      this.form.attackMin = null;
      this.form.attackMax = null;
      this.form.forceAttackMin = null;
      this.form.forceAttackMax = null;
      this.form.castId = null;

      this.form.armorClass = null;
      this.form.elements = [];
      return;
    }

    if (c === 'Weapon') {
      this.form.armorClass = null;
      this.form.defense = null;
      this.form.defenseSuccessRate = null;

      this.form.elements = [];
      return;
    }
  }

  isEquip() {
    return ['Weapon', 'Armor', 'Shield', 'Accessory'].includes(this.form.category);
  }

  showType() {
    return ['Weapon', 'Armor', 'Accessory'].includes(this.form.category);
  }

  typeOptionsUi(): UiSelectOption<any>[] {
    if (this.form.category === 'Weapon') return asOptions(WEAPON_TYPES);
    if (this.form.category === 'Armor') return asOptions(ARMOR_TYPES);
    if (this.form.category === 'Accessory') return asOptions(ACCESSORY_TYPES);
    return [];
  }

  requiresGrade() {
    return ['Weapon', 'Armor', 'Shield'].includes(this.form.category);
  }

  gradeOptionsUi(): UiSelectOption<any>[] {
    if (this.form.category === 'Weapon') return asOptions(WEAPON_GRADES);
    if (this.form.category === 'Shield') return asOptions(SHIELD_GRADES);
    if (this.form.category === 'Armor') return asOptions(['Normal', 'Rare B', 'Rare C', 'Rare D', 'Superior', 'Hero'] as const);
    return [];
  }

  canUpgrade() {
    return ['Weapon', 'Armor', 'Shield'].includes(this.form.category);
  }

  canHaveEffects() {
    return ['Weapon', 'Armor', 'Shield', 'Accessory'].includes(this.form.category);
  }

  hasElement(el: ItemElement) {
    return this.form.elements.includes(el);
  }

  toggleElement(el: ItemElement) {
    if (this.saving) return;

    const idx = this.form.elements.indexOf(el);
    if (idx >= 0) {
      this.form.elements = this.form.elements.filter((x) => x !== el);
      return;
    }

    if (this.form.elements.length >= 4) return;
    this.form.elements = [...this.form.elements, el];
  }

  addEffect() {
    this.form.specialEffects = [...this.form.specialEffects, ''];
  }

  setEffect(i: number, v: any) {
    const next = this.form.specialEffects.slice();
    next[i] = typeof v === 'string' ? v : String(v ?? '');
    this.form.specialEffects = next;
  }

  removeEffect(i: number) {
    this.form.specialEffects = this.form.specialEffects.filter((_, idx) => idx !== i);
  }

  canSubmit() {
    const nameOk = !!strOrNull(this.form.name);
    if (!nameOk) return false;

    const c = this.form.category;

    if ((c === 'Resource' || c === 'Booty')) {
      if (!strOrNull(this.form.description)) return false;
      if (numOrNull(this.form.quantity) === null) return false;
      if ((numOrNull(this.form.quantity) ?? 0) <= 0) return false;
      return true;
    }

    if (['Weapon', 'Armor', 'Accessory'].includes(c) && !this.form.type) return false;

    if (['Weapon', 'Armor', 'Shield', 'Accessory'].includes(c)) {
      if (!this.form.race) return false;
      if (numOrNull(this.form.level) === null) return false;
    }

    if (c === 'Weapon') {
      if (!this.form.grade) return false;
      if (numOrNull(this.form.attackMin) === null) return false;
      if (numOrNull(this.form.attackMax) === null) return false;
      if (numOrNull(this.form.forceAttackMin) === null) return false;
      if (numOrNull(this.form.forceAttackMax) === null) return false;
    }

    if (c === 'Armor') {
      if (!this.form.grade) return false;
      if (!this.form.armorClass) return false;
      if (numOrNull(this.form.defense) === null) return false;
    }

    if (c === 'Shield') {
      if (!this.form.grade) return false;
      if (numOrNull(this.form.defense) === null) return false;
    }

    return true;
  }

  submit() {
    const c = this.form.category;

    const payload: any = {
      category: c,
      name: strOrNull(this.form.name) ?? '',
      imagePath: this.form.imagePath,
      description: this.form.description === '' ? null : strOrNull(this.form.description),

      // ✅ quantity só pra Resource/Booty
      quantity: (c === 'Resource' || c === 'Booty') ? numOrNull(this.form.quantity) : undefined,

      type: this.showType() ? (this.form.type ?? null) : undefined,

      race: this.isEquip() ? (this.form.race ?? null) : undefined,
      level: this.isEquip() ? numOrNull(this.form.level) : undefined,

      grade: this.requiresGrade() ? (this.form.grade ?? null) : undefined,

      attackMin: c === 'Weapon' ? numOrNull(this.form.attackMin) : undefined,
      attackMax: c === 'Weapon' ? numOrNull(this.form.attackMax) : undefined,
      forceAttackMin: c === 'Weapon' ? numOrNull(this.form.forceAttackMin) : undefined,
      forceAttackMax: c === 'Weapon' ? numOrNull(this.form.forceAttackMax) : undefined,
      castId: c === 'Weapon' ? numOrNull(this.form.castId) : undefined,

      armorClass: c === 'Armor' ? (this.form.armorClass ?? null) : undefined,
      defense: c === 'Armor' || c === 'Shield' ? numOrNull(this.form.defense) : undefined,
      defenseSuccessRate: c === 'Armor' || c === 'Shield' ? numOrNull(this.form.defenseSuccessRate) : undefined,

      elements: c === 'Accessory' ? (this.form.elements.length ? this.form.elements : null) : undefined,

      specialEffects: this.canHaveEffects()
        ? this.form.specialEffects.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
        : undefined,

      upgradeLevel: this.canUpgrade() ? numOrNull(this.form.upgradeLevel) : undefined,
    };

    if (this.mode === 'create') this.save.emit({ mode: 'create', payload, uploadFile: this.uploadFile });
    else this.save.emit({ mode: 'edit', id: this.item?.id, payload, uploadFile: this.uploadFile });
  }
}
