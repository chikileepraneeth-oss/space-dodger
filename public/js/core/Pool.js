/** Reuses entities instead of allocating meshes mid-game. Items need `active` and `object`. */
export class Pool {
  constructor(scene, factory) {
    this.scene = scene;
    this.factory = factory;
    this.items = [];
  }

  acquire(key) {
    let item = this.items.find((i) => !i.active && i.key === key);
    if (!item) {
      item = this.factory(key);
      item.key = key;
      this.items.push(item);
      this.scene?.add(item.object);
    }
    item.active = true;
    item.object.visible = true;
    return item;
  }

  release(item) {
    item.active = false;
    item.object.visible = false;
  }

  find(fn) {
    for (const item of this.items) if (item.active && fn(item)) return item;
    return null;
  }

  forEachActive(fn) {
    for (const item of this.items) if (item.active) fn(item);
  }

  count() {
    let n = 0;
    for (const item of this.items) if (item.active) n += 1;
    return n;
  }

  clear() {
    for (const item of this.items) this.release(item);
  }
}
