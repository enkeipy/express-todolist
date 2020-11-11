//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require('ejs');
const session = require('express-session');
const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  list: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

const itemsSchema = {
  name: String
};

const Item = mongoose.model('Item', itemsSchema);

const item1 = new Item({
  name: 'Welcome to your todolist'
});

const item2 = new Item({
  name: 'Hit the + button to add a new item'
});

const item3 = new Item({
  name: '<-- Hit this to delete an item.'
});

const defaultItems = [item1, item2, item3];

const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model('List', listSchema);

app.get("/", function(req, res) {
  if (req.isAuthenticated()) {
    res.redirect('/lists/' + req.user.username);
  } else {
    res.redirect('/login');
  }
});

app.route('/register')
  .get((req, res) => {
    res.render('register');
  })
  .post((req, res) => {
    User.register({
      username: req.body.username
    }, req.body.password, (err, user) => {
      if (err) {
        console.log(err);
        res.redirect('/register');
      } else {
        passport.authenticate('local')(req, res, () => {
          const list = new List({
            name: user.username,
            items: defaultItems
          });
          list.save();
          res.redirect('/lists/' + user.username);
        });
      }
    });
  });

app.route('/login')
  .get((req, res) => {
    res.render('login');
  })
  .post((req, res) => {
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate('local')(req, res, () => {
          res.redirect('/lists/' + user.username);
        });
      }
    });
  });

app.route('/lists/:urlUserName')
  .get((req, res) => {
    const urlUserName = req.params.urlUserName;
    if (!req.isAuthenticated()) {
      res.redirect('/login');
    } else {
      const logedUserName = req.user.username;
      if (logedUserName === urlUserName) {
        List.findOne({
          name: urlUserName
        }, function(err, foundList) {
          if (!err) {
              //Show an existing list
              res.render('list', {
                listTitle: foundList.name,
                newListItems: foundList.items
              });
          }
        });
      } else {
        res.redirect('/lists/' + logedUserName);
      }
    }
  })
  .post((req, res) => {
    const urlUserName = req.params.urlUserName;
    if (!req.isAuthenticated()) {
      res.redirect('/login');
    } else {
      const logedUserName = req.user.username;
      if (logedUserName === urlUserName) {
        const itemName = req.body.newItem;
        const listName = req.body.list;
        const item = new Item({
          name: itemName
        });
        List.findOne({
          name: listName
        }, function(err, foundList) {
          foundList.items.push(item);
          foundList.save();
          res.redirect('/lists/' + listName);
        });

      } else {
        res.redirect('/lists/' + logedUserName);
      }
    }
  });

app.post('/delete', function(req, res) {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  List.findOneAndUpdate({
    name: listName
  }, {
    $pull: {
      items: {
        _id: checkedItemId
      }
    }
  }, function(err, foundList) {
    if (!err) {
      res.redirect('/lists/' + listName);
    }
  });

});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.get('/about', (req, res) => {
  res.render('about');
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port);
