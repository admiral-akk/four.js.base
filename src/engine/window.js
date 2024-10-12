class WindowManager {
  constructor(aspect) {
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
      buffer: 20,
      aspect,
    };
    this.listeners = [];

    const container = document.querySelector("div.container");
    const canvasContainer = document.querySelector("div.relative");

    this.update = () => {
      const { buffer } = this.sizes;
      const adjustedHeight = window.innerHeight - 2 * buffer;
      const adjustedWidth = window.innerWidth - 2 * buffer;
      if (adjustedHeight * this.sizes.aspect > adjustedWidth) {
        this.sizes.width = adjustedWidth;
        this.sizes.height = adjustedWidth / this.sizes.aspect;
        this.sizes.verticalOffset =
          buffer + (adjustedHeight - this.sizes.height) / 2;
        this.sizes.horizontalOffset = buffer;
      } else {
        this.sizes.width = adjustedHeight * this.sizes.aspect;
        this.sizes.height = adjustedHeight;
        this.sizes.verticalOffset = buffer;
        this.sizes.horizontalOffset =
          buffer + (adjustedWidth - this.sizes.width) / 2;
      }
      canvasContainer.style.top = this.sizes.verticalOffset.toString() + "px";
      canvasContainer.style.left =
        this.sizes.horizontalOffset.toString() + "px";

      this.listeners.forEach((l) => {
        l.updateSize(this.sizes);
      });
    };

    window.addEventListener("resize", this.update);
    window.addEventListener("orientationchange", this.update);
    window.addEventListener("dblclick", (event) => {
      // I want the fullscreen to stop for now.
      return;
      if (event.target.className !== "webgl") {
        return;
      }
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      if (fullscreenElement) {
        document.exitFullscreen();
      } else {
        container.requestFullscreen();
      }
    });
  }
}

export { WindowManager };
