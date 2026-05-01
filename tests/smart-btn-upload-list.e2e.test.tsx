import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import "../types/jsx";
// biome-ignore lint/correctness/noUnusedImports: Used in JSX
import { renderer } from "./utils/test-renderer";

beforeAll(async () => {
  const UC = await import("@/index.js");
  UC.defineComponents(UC);
});

describe("SmartBtn upload list behavior", () => {
  describe("with dynamic mode (SmartBtn active)", () => {
    beforeEach(() => {
      const ctxName = `test-${Math.random().toString(36).slice(2)}`;
      page.render(
        <>
          <uc-file-uploader-regular dynamic ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey='demopublickey' testMode></uc-config>
        </>,
      );
    });

    it("should NOT open upload list after file selection from system dialog", async () => {
      const smartBtn = page.locator("uc-smart-btn");
      const uploadList = page.getByTestId("uc-upload-list");

      // Wait for SmartBtn to be visible
      await expect.element(smartBtn).toBeVisible();

      // Setup file chooser to upload a file
      commands.waitFileChooserAndUpload(["./fixtures/test_image.jpeg"]);

      // Click the SmartBtn to open file dialog
      await smartBtn.click();

      // Upload list should NOT be visible after file selection
      await expect.element(uploadList).not.toBeVisible();

      // But the file should still be added to the collection
      // We can verify this by checking the SmartBtn state changes
      await expect
        .poll(() => {
          const btn = page.locator("uc-smart-btn").query();
          return btn?.classList.contains("uc-uploading") || btn?.classList.contains("uc-success");
        })
        .toBeTruthy();
    });

    it("should open upload list when clicking SmartBtn after files are uploaded", async () => {
      const smartBtn = page.locator("uc-smart-btn");
      const uploadList = page.getByTestId("uc-upload-list");

      await expect.element(smartBtn).toBeVisible();

      // Add a file
      commands.waitFileChooserAndUpload(["./fixtures/test_image.jpeg"]);
      await smartBtn.click();

      // Wait for upload to complete
      await expect
        .poll(() => {
          const btn = page.locator("uc-smart-btn").query();
          return btn?.classList.contains("uc-success");
        })
        .toBeTruthy();

      // Now clicking the button should open the upload list
      await smartBtn.click();
      await expect.element(uploadList).toBeVisible();
    });
  });

  describe("without dynamic mode (regular button)", () => {
    beforeEach(() => {
      const ctxName = `test-${Math.random().toString(36).slice(2)}`;
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey='demopublickey' testMode></uc-config>
        </>,
      );
    });

    it("should open upload list after file selection (default behavior)", async () => {
      const uploadBtn = page.getByText("Upload files", { exact: true });
      await uploadBtn.click();

      const startFrom = page.getByTestId("uc-start-from");
      await expect.element(startFrom).toBeVisible();

      commands.waitFileChooserAndUpload(["./fixtures/test_image.jpeg"]);
      await startFrom.getByText("From device", { exact: true }).click();

      const uploadList = page.getByTestId("uc-upload-list");
      await expect.element(uploadList).toBeVisible();
      await expect.element(startFrom).not.toBeVisible();
    });
  });

  describe("dynamic property reactivity", () => {
    it("should update smartBtnActive flag when dynamic property changes", async () => {
      const ctxName = `test-${Math.random().toString(36).slice(2)}`;

      // Start without dynamic
      page.render(
        <>
          <uc-file-uploader-regular ctx-name={ctxName}></uc-file-uploader-regular>
          <uc-config qualityInsights={false} ctx-name={ctxName} pubkey='demopublickey' testMode></uc-config>
        </>,
      );

      const uploader = page.locator("uc-file-uploader-regular").query() as any;
      await expect.element(uploader).toBeVisible();

      // Initially should NOT have SmartBtn
      expect(page.locator("uc-smart-btn").query()).toBeNull();

      // Change to dynamic mode
      uploader.setAttribute("dynamic", "true");
      await uploader.updateComplete;

      // Now should have SmartBtn
      await expect.element(page.locator("uc-smart-btn")).toBeVisible();
    });
  });
});
