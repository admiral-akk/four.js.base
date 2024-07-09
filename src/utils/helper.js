class KeyedMap extends Map {
  set(keyedValue, value) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.set(key, value);
  }

  get(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.get(key);
  }

  delete(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.delete(key);
  }
}

class KeyedSet extends Set {
  add(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.add(key);
  }

  has(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.has(key);
  }

  delete(keyedValue) {
    const key = keyedValue.key ? keyedValue.key() : keyedValue;
    return super.delete(key);
  }
}
export { KeyedSet, KeyedMap };
