import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const OneDriveCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const hash = window.location.hash;
    console.log("OneDrive Callback Hash:", hash);

    if (hash && hash.includes("access_token")) {
      try {
        const params = new URLSearchParams(hash.replace("#", "?"));
        const token = params.get("access_token");
        const expiresIn = params.get("expires_in");

        if (token) {
          localStorage.setItem("onedrive_access_token", token);
          if (expiresIn) {
            const expiryTime = Date.now() + parseInt(expiresIn) * 1000;
            localStorage.setItem("onedrive_token_expiry", expiryTime.toString());
          }

          toast({ title: "تم ربط حساب OneDrive بنجاح" });
          console.log("OneDrive Token stored successfully");

          // Clear hash and redirect
          window.location.hash = "";
          navigate("/cloud-storage");
        } else {
          throw new Error("Token not found in hash");
        }
      } catch (error) {
        console.error("Error processing OneDrive callback:", error);
        toast({ title: "خطأ في معالجة بيانات OneDrive", variant: "destructive" });
        navigate("/cloud-storage");
      }
    } else if (hash && hash.includes("error")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const error = params.get("error");
      const errorDesc = params.get("error_description");
      console.error("OneDrive Auth Error:", error, errorDesc);
      toast({
        title: "فشل ربط OneDrive",
        description: errorDesc || "حدث خطأ أثناء المصادقة",
        variant: "destructive"
      });
      navigate("/cloud-storage");
    } else {
      // If no hash, maybe it was a direct access or something else
      console.log("No hash found in OneDrive callback");
      // Don't toast here as it might be a re-render
    }
  }, [navigate, toast]);

  return <div className="p-8 text-center">جاري معالجة ربط OneDrive...</div>;
};

export default OneDriveCallback;
