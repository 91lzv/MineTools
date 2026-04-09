require("dotenv").config();

const express = require("express");
const axios = require("axios");
const session = require("express-session");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false
    }
}));

// ------------------ DATABASE ------------------
mongoose.connect(process.env.MONGO_URI);

const UserSchema = new mongoose.Schema({
    discordId: String,
    username: String,
    avatar: String
});

const User = mongoose.model("User", UserSchema);

// ------------------ AUTH ------------------
app.get("/auth/discord", (req, res) => {
    const url = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=identify`;
    res.redirect(url);
});

app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;

    const tokenRes = await axios.post("https://discord.com/api/oauth2/token", new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.REDIRECT_URI
    }), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const access_token = tokenRes.data.access_token;

    const userRes = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${access_token}` }
    });

    const discordUser = userRes.data;

    // SAVE OR UPDATE USER
    let user = await User.findOne({ discordId: discordUser.id });

    if (!user) {
        user = await User.create({
            discordId: discordUser.id,
            username: discordUser.username,
            avatar: discordUser.avatar
        });
    } else {
        user.username = discordUser.username;
        user.avatar = discordUser.avatar;
        await user.save();
    }

    req.session.user = user;

    res.redirect(process.env.FRONTEND_URL);
});

// ------------------ USER ------------------
app.get("/api/user", (req, res) => {
    res.json(req.session.user || null);
});

// ------------------ LOGOUT ------------------
app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log("Server running"));