export function addCustomArrayMethods() {
  Array.prototype.peek = function () {
    return this.length ? this[this.length - 1] : null;
  };
}
