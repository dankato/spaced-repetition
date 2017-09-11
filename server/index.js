const path = require('path');
const express = require('express');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const keys = require('./config/keys');
const mongoose = require("mongoose");

const { User } = require('./models/users')
mongoose.connect(keys.MONGO_URI);

let secret = {
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  MONGO_URI: process.env.MONGO_URI
};

if(process.env.NODE_ENV != 'production') {
  secret = require('./config/keys');
}

const app = express();

app.use(passport.initialize());

passport.use(
    new GitHubStrategy({
        clientID:  secret.CLIENT_ID,
        clientSecret: secret.CLIENT_SECRET,
        callbackURL: `/api/auth/github/callback`
    },
    (accessToken, refreshToken, profile, cb) => {
        // Job 1: Set up Mongo/Mongoose, create a User model which store the
        // github id, and the access token
        // Job 2: Update this callback to either update or create the user
        // so it contains the correct access token
        // const user = database[accessToken] = {
        //     gitHubId: profile.id,
        //     accessToken: accessToken
        // };
        
        // Look to see if user is already in database - could use accessToken
        User.findOne({accessToken: accessToken})
            .then( user => {
                // if the user is there, then return user
                if (user) {
                    return cb(null, user);
                } else {
                // if the user is not there, then we will create a new user 
                User.create({
                    gitHubId: accessToken
                })
                }
            })
            .then(user => {
                return cb(null, user);
            })
        
    }
));
passport.use(
    new BearerStrategy(
        (token, done) => {
            // Job 3: Update this callback to try to find a user with a
            // matching access token.  If they exist, let em in, if not,
            // don't.
              User.findOne({accessToken})
              .then( user => {
                  if (!user) {
                    return done(null, false);
                  } else {
                    return done(null, user);
                  }
              })
        }
    )
);

app.get('/api/auth/github',
    passport.authenticate('github', {scope: ['profile']}));

app.get('/api/auth/github/callback',
    passport.authenticate('github', {
        failureRedirect: '/',
        session: false
    }),
    (req, res) => {
        res.cookie('accessToken', req.user.accessToken, {expires: 0});
        res.redirect('/');
    }
);

app.get('/api/auth/logout', (req, res) => {
    req.logout();
    res.clearCookie('accessToken');
    res.redirect('/');
});

app.get('/api/me',
    passport.authenticate('bearer', {session: false}),
    (req, res) => res.json({
        gitHubId: req.user.gitHubId
    })
);

app.get('/api/questions',
    passport.authenticate('bearer', {session: false}),
    // res.redirect('/question-page'),
    (req, res) => res.json(['Question 1', 'Question 2']),
);

// Serve the built client
app.use(express.static(path.resolve(__dirname, '../client/build')));

// Unhandled requests which aren't for the API should serve index.html so
// client-side routing using browserHistory can function
app.get(/^(?!\/api(\/|$))/, (req, res) => {
    const index = path.resolve(__dirname, '../client/build', 'index.html');
    res.sendFile(index);
});

let server;
function runServer(port=3001) {
    return new Promise((resolve, reject) => {
        mongoose.connect(secret.MONGO_URI, err => {
            if (err) {
                return reject(err);
            }
        })
        server = app.listen(port, () => {
            resolve();
        }).on('error', reject);
    });
}

function closeServer() {
    return new Promise((resolve, reject) => {
        server.close(err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

if (require.main === module) {
    runServer();
}

module.exports = {
    app, runServer, closeServer
};
