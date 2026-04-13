"use client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
// import { Provider } from "react-redux";
// import store from "../redux/store";

// Create a custom theme that matches your previous styling
const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "sm",
  components: {
    Button: {
      defaultProps: {
        size: "sm",
      },
    },
    Paper: {
      defaultProps: {
        p: "md",
        shadow: "sm",
        withBorder: true,
      },
    },
    TextInput: {
      defaultProps: {
        size: "sm",
      },
    },
    NumberInput: {
      defaultProps: {
        size: "sm",
      },
    },
    Textarea: {
      defaultProps: {
        size: "sm",
      },
    },
    ActionIcon: {
      defaultProps: {
        size: "sm",
      },
    },
  },
  colors: {
    // You can customize your color palette here
    blue: [
      "#E7F5FF",
      "#D0EBFF",
      "#A5D8FF",
      "#74C0FC",
      "#4DABF7",
      "#339AF0",
      "#228BE6",
      "#1C7ED6",
      "#1971C2",
      "#1864AB",
    ],
  },
});

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* <Provider store={store}> */}
      <MantineProvider theme={theme} forceColorScheme="light">
        <Notifications position="bottom-right" zIndex={2077} />
        {children}
      </MantineProvider>
      {/* </Provider> */}
    </>
  );
}
