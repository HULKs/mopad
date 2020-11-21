import useDocumentsAsArray from "./useDocumentsAsArray";

export default function useTalks() {
  return useDocumentsAsArray("talks");
}
