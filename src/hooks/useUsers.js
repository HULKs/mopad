import useDocumentsAsObject from "./useDocumentsAsObject";

export default function useUsers() {
  return useDocumentsAsObject("users");
}
