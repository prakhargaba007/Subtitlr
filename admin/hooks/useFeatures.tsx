import axios from "axios";
import { useEffect, useState } from "react";

export const useFeatures = () => {
  const [features, setFeatures] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const response = await axios.get(
          "https://bug-x.vercel.app/features/monsterpoker"
        );
        setFeatures(response.data.feature.isActive);
      } catch (err) {
        console.log(
          err instanceof Error ? err.message : "Something went wrong."
        );
        setFeatures(false);
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
  }, []);

  return { features, loading };
};
