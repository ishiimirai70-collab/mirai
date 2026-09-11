import { world, system } from "@minecraft/server";

const SLIME_TYPE = "tensura:slime";
const HUMAN_SOURCE_TYPE = "minecraft:villager_v2";

// When the slime lands the killing blow on a villager, it "absorbs" them:
// the villager is consumed and the slime unlocks the ability to shapeshift
// into a human form (toggled later via right-click interaction).
world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const attacker = event.damageSource && event.damageSource.damagingEntity;

  if (!deadEntity || deadEntity.typeId !== HUMAN_SOURCE_TYPE) return;
  if (!attacker || attacker.typeId !== SLIME_TYPE) return;

  system.run(() => {
    try {
      attacker.triggerEvent("tensura:on_absorb");
      attacker.dimension.spawnParticle("minecraft:mobflame_single", attacker.location);
      attacker.dimension.playSound("mob.slime.big", attacker.location);
    } catch (error) {
      // The slime may no longer be valid by the time this runs; safe to ignore.
    }
  });
});
