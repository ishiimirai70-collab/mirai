import { world, system } from "@minecraft/server";

const SPIDER_TYPE = "webhero:spider";
const BITE_SOURCE_TYPE = "minecraft:villager_v2";

// When the mutant spider lands the killing blow on a villager, it "bites" them:
// the villager is consumed and the spider unlocks the ability to shapeshift
// into a masked hero form (toggled later via right-click interaction).
world.afterEvents.entityDie.subscribe((event) => {
  const deadEntity = event.deadEntity;
  const attacker = event.damageSource && event.damageSource.damagingEntity;

  if (!deadEntity || deadEntity.typeId !== BITE_SOURCE_TYPE) return;
  if (!attacker || attacker.typeId !== SPIDER_TYPE) return;

  system.run(() => {
    try {
      attacker.triggerEvent("webhero:on_bite");
      attacker.dimension.spawnParticle("minecraft:mobflame_single", attacker.location);
      attacker.dimension.playSound("mob.spider.say", attacker.location);
    } catch (error) {
      // The spider may no longer be valid by the time this runs; safe to ignore.
    }
  });
});
