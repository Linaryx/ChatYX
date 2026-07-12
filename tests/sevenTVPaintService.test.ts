import { describe, expect, test } from "bun:test";
import { SevenTVPaintService, type Paint } from "../src/services/chat/sevenTVPaintService";

function createPaint(): Paint {
  return {
    id: "paint-1",
    name: "Test Paint",
    function: "LINEAR_GRADIENT",
    color: null,
    angle: 15,
    stops: [
      { at: 0, color: 0xff0000 },
      { at: 1, color: 0x0000ff },
    ],
  };
}

describe("SevenTVPaintService CSS cache", () => {
  test("reuses generated CSS until the paint is updated", () => {
    const service = new SevenTVPaintService();
    const paint = createPaint();
    service.addPaint(paint);

    const initialCss = service.generatePaintCSS(paint);
    paint.angle = 90;

    expect(service.generatePaintCSS(paint)).toBe(initialCss);

    service.addPaint(paint);
    expect(service.generatePaintCSS(paint)).toContain("linear-gradient(90deg");
  });

  test("invalidates cached CSS when a paint is removed and replaced", () => {
    const service = new SevenTVPaintService();
    const paint = createPaint();
    service.addPaint(paint);
    service.generatePaintCSS(paint);

    service.removePaint(paint.id);
    const replacement = { ...paint, angle: 120 };
    service.addPaint(replacement);

    expect(service.generatePaintCSS(replacement)).toContain(
      "linear-gradient(120deg",
    );
  });
});
