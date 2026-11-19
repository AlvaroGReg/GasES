import type { ProvinceGeometry } from '../types/province-map';

export const normalizeProvinceName = (name: string) =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');

const provinceAliases = new Map<string, string>([
    ['La Coruña', 'A Coruña'], ['Alacant', 'Alicante'], ['Alacant/Alicante', 'Alicante'],
    ['Araba', 'Álava'], ['Araba/Álava', 'Álava'], ['Baleares', 'Illes Balears'],
    ['Vizcaya', 'Bizkaia'], ['Bizkaia/Vizcaya', 'Bizkaia'], ['Castelló', 'Castellón'],
    ['Castelló/Castellón', 'Castellón'], ['Gerona', 'Girona'], ['Guipúzcoa', 'Gipuzkoa'],
    ['Gipuzkoa/Guipúzcoa', 'Gipuzkoa'], ['Lérida', 'Lleida'], ['Orense', 'Ourense'],
    ['Santa Cruz De Tenerife', 'Santa Cruz de Tenerife'], ['València', 'Valencia'],
    ['València/Valencia', 'Valencia'],
].map(([alias, canonical]) => [normalizeProvinceName(alias), canonical] as const));

export function canonicalProvinceName(name: string): string {
    return provinceAliases.get(normalizeProvinceName(name)) ?? name.trim();
}

export function getProvinceName(feature: ProvinceGeometry): string {
    const properties = feature.properties;
    return canonicalProvinceName(properties.name ?? properties.NAME_2 ?? properties.provincia ?? properties.NAME ?? '');
}
