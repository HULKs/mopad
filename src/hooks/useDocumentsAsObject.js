import { useState, useEffect } from "react";
import firebase from "firebase/app";
import { useCollection } from "react-firebase-hooks/firestore";

export default function useDocumentsAsObject(collectionName) {
  const [collection, collectionLoading, collectionError] = useCollection(
    firebase.firestore().collection(collectionName)
  );

  const [documents, setDocuments] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!collectionLoading && collection) {
      setDocuments(
        collection.docs.reduce(
          (accumulator, reference) => ({
            ...accumulator,
            [reference.id]: reference.data(),
          }),
          {}
        )
      );
      setLoading(false);
    }
  }, [collectionLoading, collection]);

  return [documents, loading, collectionError];
}
