class WindowManager {
  constructor(aspect) {
    this.sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
      verticalOffset: 0,
      horizontalOffset: 0,
      aspect,
    };
    this.listeners = [];

    const container = document.querySelector("div.container");
    const canvasContainer = document.querySelector("div.relative");

    this.update = () => {
      if (window.innerHeight * this.sizes.aspect > window.innerWidth) {
        this.sizes.width = window.innerWidth;
        this.sizes.height = window.innerWidth / this.sizes.aspect;
        this.sizes.verticalOffset =
          (window.innerHeight - this.sizes.height) / 2;
        this.sizes.horizontalOffset = 0;
      } else {
        this.sizes.width = window.innerHeight * this.sizes.aspect;
        this.sizes.height = window.innerHeight;
        this.sizes.verticalOffset = 0;
        this.sizes.horizontalOffset =
          (window.innerWidth - this.sizes.width) / 2;
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
