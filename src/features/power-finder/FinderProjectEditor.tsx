import type { FinderControllerContract } from "./controller-contract";
export function FinderProjectEditor({ model }: { model: FinderControllerContract }) {
  const { projectEditorOpen, setProjectEditorOpen } = model;
  return (
    <button
      type="button"
      aria-label={projectEditorOpen ? "Close brief" : "Screening brief"}
      aria-expanded={projectEditorOpen}
      aria-controls="finder-project-editor"
      onClick={() => {
        const opening = !projectEditorOpen;
        setProjectEditorOpen(opening);
        if (opening) {
          window.requestAnimationFrame(() =>
            document
              .getElementById("finder-project-editor")
              ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
          );
        }
      }}
    >
      {projectEditorOpen ? "Close site brief" : "Edit site brief"}
    </button>
  );
}
