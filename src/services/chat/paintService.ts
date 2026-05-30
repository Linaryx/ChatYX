// 7TV username paint/cosmetic service

export interface Paint {
  id: string;
  name: string;
  function: string;
  color: number | null;
  stops: Array<{ at: number; color: number }>;
  shadows?: Array<{
    x_offset: number;
    y_offset: number;
    radius: number;
    color: number;
  }>;
  angle?: number;
  shape?: string;
  image_url?: string;
}

export class PaintService {
  private paints: Map<string, Paint> = new Map();
  private userPaints: Map<string, string[]> = new Map(); // username -> paintIds

  addPaint(paint: Paint) {
    this.paints.set(paint.id, paint);
  }

  removePaint(paintId: string) {
    this.paints.delete(paintId);
  }

  getPaint(paintId: string): Paint | undefined {
    return this.paints.get(paintId);
  }

  addUserPaint(username: string, paintId: string) {
    username = username.toLowerCase();
    if (!this.userPaints.has(username)) {
      this.userPaints.set(username, []);
    }
    const paints = this.userPaints.get(username)!;
    if (!paints.includes(paintId)) {
      paints.push(paintId);
    }
  }

  removeUserPaint(username: string, paintId: string) {
    username = username.toLowerCase();
    if (this.userPaints.has(username)) {
      const paints = this.userPaints.get(username)!;
      this.userPaints.set(
        username,
        paints.filter((id) => id !== paintId),
      );
    }
  }

  getUserPaints(username: string): Paint[] {
    username = username.toLowerCase();
    const paintIds = this.userPaints.get(username) || [];
    return paintIds
      .map((id) => this.paints.get(id))
      .filter((paint) => paint !== undefined) as Paint[];
  }

  generatePaintCSS(paint: Paint): string {
    const { function: func, color, stops, shadows, angle, image_url } = paint;

    let css = "";

    // Handle gradients
    if (func === "LINEAR_GRADIENT" && stops && stops.length > 0) {
      const angleValue = angle || 0;
      const gradient = stops
        .map((stop) => {
          const colorHex = "#" + stop.color.toString(16).padStart(6, "0");
          return `${colorHex} ${stop.at * 100}%`;
        })
        .join(", ");

      css += `background: linear-gradient(${angleValue}deg, ${gradient});`;
      css += "background-clip: text;";
      css += "-webkit-background-clip: text;";
      css += "-webkit-text-fill-color: transparent;";
    } else if (func === "RADIAL_GRADIENT" && stops && stops.length > 0) {
      const gradient = stops
        .map((stop) => {
          const colorHex = "#" + stop.color.toString(16).padStart(6, "0");
          return `${colorHex} ${stop.at * 100}%`;
        })
        .join(", ");

      css += `background: radial-gradient(circle, ${gradient});`;
      css += "background-clip: text;";
      css += "-webkit-background-clip: text;";
      css += "-webkit-text-fill-color: transparent;";
    } else if (func === "URL" && image_url) {
      css += `background: url(${image_url});`;
      css += "background-clip: text;";
      css += "-webkit-background-clip: text;";
      css += "-webkit-text-fill-color: transparent;";
      css += "background-size: cover;";
    } else if (color !== null) {
      // Solid color
      const colorHex = "#" + color.toString(16).padStart(6, "0");
      css += `color: ${colorHex};`;
    }

    // Handle shadows
    if (shadows && shadows.length > 0) {
      const shadowStrings = shadows.map((shadow) => {
        const colorHex = "#" + shadow.color.toString(16).padStart(8, "0");
        return `${shadow.x_offset}px ${shadow.y_offset}px ${shadow.radius}px ${colorHex}`;
      });
      css += `text-shadow: ${shadowStrings.join(", ")};`;
    }

    return css;
  }
}

export const paintService = new PaintService();
