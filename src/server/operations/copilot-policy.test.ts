import { expect, it } from "vitest";
import { modelAccessAllowed } from "./copilot-policy";
it("uses trusted Worker metadata instead of a spoofed country header", () => {
  const request = new Request("https://app.invalid", { headers: { "cf-ipcountry": "DE" } });
  Object.defineProperty(request, "cf", { value: { country: "IR" } });
  expect(modelAccessAllowed(request)).toBe(false);
  expect(modelAccessAllowed(new Request("https://app.invalid"))).toBe(true);
});

it("requires trustworthy country metadata for private-data policy",()=>{
 expect(modelAccessAllowed(new Request("https://test.invalid"),true)).toBe(false);
 const request=Object.assign(new Request("https://test.invalid"),{cf:{country:"DE"}});
 expect(modelAccessAllowed(request,true)).toBe(true);
});
