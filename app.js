var apiUrl = "https://api.github.com";

function getIssues(token, filter) {
    return axios.get(
        apiUrl + '/search/issues',
        {
            params: {
                q: 'is:open archived:false ' + filter
            },
            headers: {
                Authorization: 'token ' + token
            }
        }
    )
}

// Storage for getting data from local storage
var storage = {
  get: function(key) {
    // Fetch data from localStorage
    var value = localStorage.getItem(key);
    if (value != undefined) {
        return JSON.parse(localStorage.getItem(key));
    }
    return undefined;
  },
  set: function(key, value) {
    // Save data to localStorage
    localStorage.setItem(key, JSON.stringify(value));
  }
}

var app = new Moon({
    el: "#app",
    data: {
        issues: [],
        token: null,
        show: false
    },
    methods: {
        setToken: function() {
            var self = this;
            token = self.get('token');
            storage.set('token', token);
            axios.get(
                apiUrl + '/user',
                {
                    headers: {
                        Authorization: 'token ' + token
                    }
                }
            ).then(function(results) {
                storage.set('login', results.data.login);
                self.callMethod('fetch', []);
            }).catch(function(error) {
                console.log(error);
            });
        },
        fetch: function() {
            var self = this;
            var token = storage.get('token');
            var login = storage.get('login');

            if (!token || !login) {
                self.set('show', false);
                return
            }

            self.set('token', token);
            self.set('show', true);

            requests = [
                getIssues(token, 'is:issue assignee:' + login),
                getIssues(token, 'is:pr assignee:' + login),
                getIssues(token, 'is:pr review-requested:' + login),
                getIssues(token, 'is:pr review:changes_requested reviewed-by:' + login)
            ];
            axios.all(requests).then(function(results) {
                var issues = [];

                for (var result of results) {
                    issues.push.apply(issues, result.data.items);
                }

                for (var issue of issues) {
                    var repoUrl = issue['repository_url'].replace('//api.', '//').replace('/repos/', '/');
                    var repo = repoUrl.split('/').slice(-2).join('/');
                    issue['repository'] = {
                        name: repo,
                        html_url: repoUrl
                    }
                    issue['is_pull_request'] = (typeof issue.pull_request != 'undefined');
                    issue['created_at_human'] = moment(issue['created_at']).fromNow();
                    for (label of issue.labels) {
                        label.text_color = tinycolor(label.color).isLight() ? 'black' : 'white';
                    }
                    var assigned = false;
                    for (var assignee of issue.assignees) {
                        if (assignee.login == login) {
                            assigned = true;
                        }
                    }
                    issue['review_requested'] = !assigned;
                }

                issues.sort(function(a, b) {
                    if (a.repository.name == b.repository.name) {
                        return (a.number - b.number);
                    } else {
                        return (a.repository.name - b.repository.name);
                    }
                });

                self.set('issues', issues);
                console.log(issues);
            }).catch(function(error) {
                console.log(error);
            });
        }
    },
    hooks: {
        mounted: function() {
            var self = this;
            this.callMethod("fetch", []);
            window.setInterval(function() { self.callMethod("fetch", []); }, 60000);
        }
    }
});
