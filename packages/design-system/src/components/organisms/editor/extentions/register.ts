// You can find the list of extensions here: https://tiptap.dev/docs/editor/extensions/functionality

import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

// StarterKit v3 bundles the Link and Underline extensions, so configure Link
// through StarterKit rather than registering a duplicate extension.
const extensions = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    },
  }),
];

export function registerExtensions(options?: { placeholder?: string }) {
  const { placeholder } = options ?? {};
  return [...extensions, Placeholder.configure({ placeholder })];
}
