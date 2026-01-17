/**
 * InfoPopup - A popup component for displaying info about timeline items
 */

const INFO_POPUP_STYLES = `
.info-popup {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  min-width: 200px;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
}

.info-popup-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.info-popup-close:hover {
  background: #f0f0f0;
  color: #333;
}

.info-popup-content {
  padding: 12px 16px;
  padding-right: 36px;
  white-space: pre-wrap;
  line-height: 1.5;
  color: #333;
}
`;

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;

  const styleElement = document.createElement("style");
  styleElement.setAttribute("data-thymeline-info-popup", "");
  styleElement.textContent = INFO_POPUP_STYLES;
  document.head.appendChild(styleElement);
  stylesInjected = true;
}

export class InfoPopup {
  private element: HTMLDivElement | null = null;
  private container: HTMLElement;
  private documentClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    injectStyles();
  }

  /**
   * Show the popup with the given content at the specified position
   * @param content The text content to display
   * @param x X coordinate relative to the viewport
   * @param y Y coordinate relative to the viewport
   */
  show(content: string, x: number, y: number): void {
    // Hide any existing popup first
    this.hide();

    // Create popup element
    this.element = document.createElement("div");
    this.element.className = "info-popup";

    // Create close button
    const closeButton = document.createElement("button");
    closeButton.className = "info-popup-close";
    closeButton.innerHTML = "&times;";
    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });

    // Create content area
    const contentDiv = document.createElement("div");
    contentDiv.className = "info-popup-content";
    contentDiv.textContent = content;

    this.element.appendChild(closeButton);
    this.element.appendChild(contentDiv);

    // Add to container
    this.container.appendChild(this.element);

    // Position the popup
    this.positionPopup(x, y);

    // Add document click listener to close on outside click
    // Use setTimeout to avoid the current click event from triggering it
    setTimeout(() => {
      this.documentClickHandler = (e: MouseEvent) => {
        if (this.element && !this.element.contains(e.target as Node)) {
          this.hide();
        }
      };
      document.addEventListener("click", this.documentClickHandler);
    }, 0);
  }

  /**
   * Position the popup near the click point, adjusting for container edges
   */
  private positionPopup(clickX: number, clickY: number): void {
    if (!this.element) return;

    const containerRect = this.container.getBoundingClientRect();
    const popupWidth = 250; // Approximate width, will be set by CSS
    const popupHeight = 150; // Approximate max height
    const offset = 10; // Offset from click point

    // Calculate position relative to container
    let left = clickX - containerRect.left + offset;
    let top = clickY - containerRect.top + offset;

    // Adjust if popup would go outside container on the right
    if (left + popupWidth > containerRect.width) {
      left = clickX - containerRect.left - popupWidth - offset;
    }

    // Adjust if popup would go outside container on the bottom
    if (top + popupHeight > containerRect.height) {
      top = clickY - containerRect.top - popupHeight - offset;
    }

    // Ensure popup doesn't go negative
    left = Math.max(10, left);
    top = Math.max(10, top);

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  /**
   * Hide and remove the popup
   */
  hide(): void {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }

    if (this.documentClickHandler) {
      document.removeEventListener("click", this.documentClickHandler);
      this.documentClickHandler = null;
    }
  }

  /**
   * Check if the popup is currently visible
   */
  isVisible(): boolean {
    return this.element !== null;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.hide();
  }
}
