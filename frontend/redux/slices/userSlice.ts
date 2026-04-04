// redux/slices/userSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/utils/axios";

interface UserInfo {
  _id: string;
  name: string;
  email: string;
  userName: string;
  profilePicture?: string;
  role?: string;
  isVerified?: boolean;
  isActive?: boolean;
  tempUser?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface UserState {
  userInfo: UserInfo | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: UserState = {
  userInfo: null,
  status: 'idle',
  error: null,
};

// Thunk to fetch user details from the API using GET request with authorization
export const fetchUser = createAsyncThunk(
  "user/fetchUser",
  async (_, thunkAPI) => {
    try {
      const response = await axiosInstance.get(`/api/user/profile`);
      // console.log("response", response.data);

      if (!response.data) {
        throw new Error("Failed to fetch user");
      }

      const userData = await response.data;
      // console.log("userData", userData);

      return userData;
    } catch (error: unknown) {
      console.log(error);

      return thunkAPI.rejectWithValue(
        error instanceof Error ? error.message : 'Failed to fetch user'
      );
    }
  }
);

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    // Reducer to set user details directly after login
    setUserDetails: (state, action: { payload: UserInfo }) => {
      state.userInfo = action.payload;
      state.status = "succeeded"; // Mark as succeeded since data is available
    },
    // Optional: If you want to reset the user state
    clearUserDetails: (state) => {
      state.userInfo = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.userInfo = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });
  },
});

export const { setUserDetails, clearUserDetails } = userSlice.actions;

export default userSlice.reducer;
