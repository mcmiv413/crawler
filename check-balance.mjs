import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./balance-results/balance-2026-03-23T19-55-33.json'));

const maxFloor = Math.max(...data.results.map(r => r.maxFloorReached));
const floor5Plus = data.results.filter(r => r.maxFloorReached >= 5).length;
const victories = data.results.filter(r => r.sessionEndReason === 'victory').length;
const rareGear = data.results.filter(r => r.equipmentSnapshot.equippedRarities.some(x => x !== 'common')).length;

console.log('=== Floor Analysis ===');
console.log('Max floor reached by anyone:', maxFloor);
console.log('Runs reaching floor 5+:', floor5Plus);
console.log('Victories:', victories);

console.log('\n=== Gear Rarity ===');
console.log('Runs with rare/uncommon gear:', rareGear, '/', data.results.length);

// Check rarity distribution
const rarityMap = {};
data.results.forEach(r => {
  r.equipmentSnapshot.equippedRarities.forEach(rarity => {
    rarityMap[rarity] = (rarityMap[rarity] || 0) + 1;
  });
});
console.log('Rarity distribution:', rarityMap);

// Check if anyone has enchanted items (weapon with damage > 2)
const enchantedCount = data.results.filter(r => r.equipmentSnapshot.weaponDamage > 2).length;
console.log('\n=== Enchantments / Upgrades ===');
console.log('Runs with upgraded weapons (dmg > 2):', enchantedCount);
