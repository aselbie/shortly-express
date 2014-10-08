var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bcrypt = require('bcrypt');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var linkController = require ('./app/controllers/link.controller');
var passport= require('passport');
var gitHubStrategy= require('passport-github').Strategy;

passport.serializeUser(function(user,done){
  done(null, user);
})

passport.deserializeUser(function(obj,done){
  done(null, obj);
})

passport.use(new gitHubStrategy({
    clientID: '0cc2a75f391f4535c8af',
    clientSecret: 'd8af8c392eacda7c682ede827f4e4d5b8e3f8caa',
    callbackURL: "http://127.0.0.1:3000/auth/github/callback"
  }, function(accessToken, refreshToken, profile, done){

    return done(null, profile);

    new User({username: profile.username})
      .fetch()
      .then(function(user){
        console.log(user);
        if (user) {
          done(null, user);
        } else {
          new User({
            username: profile.username,
          }).save().then(function(user){
            console.log(user);
            done(null, user);
          });
        }
      });

  }
));

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(expressSession({secret: 'noOneKnows'}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

app.get('/', ensureAuthenticated,//restrict,
function(req, res) {
  res.render('index');
});

// app.get('/login',
// function(req, res) {
//   res.render('login');
// });

// app.get('/signup',
// function(req, res) {
//   res.render('signup');
// });

app.get('/create', ensureAuthenticated,//restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', ensureAuthenticated,//restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', linkController.post);


/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/auth/github', passport.authenticate('github'), function(req, res){
  // Will not be called because Github will redirect.
});

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/');
  });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/login');
})

function ensureAuthenticated(req, res, next) {
  console.log('ensureAuthenticated');
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect('/auth/github');
  }
}




/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 3000');
app.listen(3000);
