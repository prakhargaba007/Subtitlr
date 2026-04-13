"use client";
import { useState } from "react";
import {
  Paper,
  TextInput,
  PasswordInput,
  Button,
  Title,
  LoadingOverlay,
  Alert,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle } from "@tabler/icons-react";
import classes from "./AuthenticationImage.module.css";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { notifications } from "@mantine/notifications";
import { assets } from "@/assets/assets";

interface LoginForm {
  id: string;
  password: string;
}

export function AuthenticationImage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const form = useForm<LoginForm>({
    initialValues: {
      id: "",
      password: "",
    },
    validate: {
      id: (value) =>
        value.length < 3 ? "Username must be at least 3 characters" : null,
      password: (value) =>
        value.length < 6 ? "Password must be at least 6 characters" : null,
    },
  });

  const handleSubmit = async (values: LoginForm) => {
    try {
      setLoading(true);
      setError("");

      const response = await axiosInstance.post(`/api/auth/login`, {
        id: values.id,
        password: values.password,
      });

      // Store the token in localStorage
      localStorage.setItem("token", response.data.token);
      console.log("response.data.role", response.data.user.role);

      // Store user role and other relevant data
      localStorage.setItem("userRole", response.data.user.role);
      localStorage.setItem("userData", JSON.stringify(response.data.user));

      // Set authorization header for future requests
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${response.data.token}`;

      // Redirect based on user role
      // switch (response.data.role) {
      //   case "superAdmin":
      //     router.push("/dashboard/super-admin");
      //     break;
      //   case "schoolAdmin":
      //     router.push("/dashboard/school-admin");
      //     break;
      //   default:
      //   }
      notifications.show({
        title: "Success",
        message: "Login successful",
        color: "green",
      });
      router.push("/dashboard");
    } catch (err: any) {
      // setError(
      //   err.response?.data?.message ||
      //     "An error occurred during login. Please try again."
      // );
      notifications.show({
        title: "Error",
        message: err.response?.data?.message || "Failed to login",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={classes.wrapper}>
      <Paper className={`${classes.form} mx-10  w-[30%]`} pt={100} radius={0}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        <div className={classes.logo}>
          <Image
            src={assets.gharwaleLogoFinal}
            alt="logo"
            width={200}
            height={200}
            style={{ width: "30%", height: "auto" }}
          />
          <span className="text-2xl font-bold">GharWale.AI</span>
        </div>

        <Title order={2} className={classes.title} ta="center" mt="md" mb={50}>
          Welcome to Admin Portal
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Username"
            placeholder="Your username"
            size="md"
            {...form.getInputProps("id")}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            mt="md"
            size="md"
            {...form.getInputProps("password")}
          />

          <Button fullWidth mt="xl" size="md" type="submit" loading={loading}>
            Login
          </Button>
        </form>
      </Paper>

      <div className={classes.image} />
    </div>
  );
}
