(function() {
    ngApp = angular.module('ngApp', ['blockUI', 'ui.bootstrap']);

    ngApp.controller('mainController', [
        '$scope',
        '$http',
        '$q',
        '$timeout',
        function($scope, $http, $q, $timeout) {
            var apiUrl = "https://api.github.com";

            function getIssues(token, filter) {
                return $http.get(
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

            $scope.issues = [];
            $scope.labels = [];
            $scope.repos = [];
            $scope.ignoredLabels = storage.get('ignoredLabels') || [];
            $scope.ignoredRepos = storage.get('ignoredRepos') || [];
            $scope.token = null;
            $scope.show = false;

            $scope.toggleRepoIgnore = function(repo) {
                var index = $scope.ignoredRepos.indexOf(repo);
                if (index == -1) {
                    $scope.ignoredRepos.push(repo);
                } else {
                    $scope.ignoredRepos.splice(index, 1);
                }
                storage.set('ignoredRepos', $scope.ignoredRepos);
            }

            $scope.isRepoActive = function(repo) {
                return $scope.ignoredRepos.indexOf(repo) == -1;
            }

            $scope.toggleLabelIgnore = function(label) {
                var index = $scope.ignoredLabels.indexOf(label);
                if (index == -1) {
                    $scope.ignoredLabels.push(label);
                } else {
                    $scope.ignoredLabels.splice(index, 1);
                }
                storage.set('ignoredLabels', $scope.ignoredLabels);
            }

            $scope.isLabelActive = function(label) {
                return $scope.ignoredLabels.indexOf(label) == -1;
            }

            $scope.filterIssues = function(value, index, array) {
                if ($scope.ignoredRepos.indexOf(value.repository.name) != -1) {
                    return false;
                }

                for (var label of value.labels) {
                    if ($scope.ignoredLabels.indexOf(label.name) != -1) {
                        return false;
                    }
                }

                return true;
            }

            $scope.setToken = function() {
                token = $scope.token;
                storage.set('token', token);
                $http.get(
                    apiUrl + '/user',
                    {
                        headers: {
                            Authorization: 'token ' + token
                        }
                    }
                ).then(function(results) {
                    storage.set('login', results.data.login);
                    $scope.fetch();
                }).catch(function(error) {
                    console.log(error);
                });
            };

            $scope.fetch = function() {

                var self = this;
                var token = storage.get('token');
                var login = storage.get('login');

                if (!token || !login) {
                    $scope.show = false;
                    return
                }

                $scope.token = token;
                $scope.show = true;

                requests = [
                    //getIssues(token, 'is:issue author:' + login),
                    //getIssues(token, 'is:pr author:' + login),
                    getIssues(token, 'is:issue assignee:' + login),
                    getIssues(token, 'is:pr assignee:' + login),
                    getIssues(token, 'is:pr review-requested:' + login),
                    getIssues(token, 'is:pr review:changes_requested reviewed-by:' + login)
                ];
                $q.all(requests).then(function(results) {
                    var _issues = [];
                    var _seenLabelNames = [];
                    var _seenRepoNames = [];

                    for (var result of results) {
                        _issues.push.apply(_issues, result.data.items);
                    }

                    $scope.labels = [];
                    $scope.repos = [];
                    $scope.issues = [];
                    for (var i = 0, len = _issues.length; i < len; i++) {
                        var issue = _issues[i];
                        var repoUrl = issue['repository_url'].replace('//api.', '//').replace('/repos/', '/');
                        var repo = repoUrl.split('/').slice(-2).join('/');
                        issue['repository'] = {
                            name: repo,
                            html_url: repoUrl
                        }

                        if ($scope.repos.indexOf(repo) == -1) {
                            $scope.repos.push(repo);
                        }

                        issue['is_pull_request'] = (typeof issue.pull_request != 'undefined');
                        issue['created_at_human'] = moment(issue['created_at']).fromNow();

                        var labelMatch = false;
                        for (label of issue.labels) {
                            if ($scope.ignoredLabels.indexOf(label.name) != -1) {
                                labelMatch = true;
                            }
                            label.text_color = tinycolor(label.color).isLight() ? 'black' : 'white';
                            if (_seenLabelNames.indexOf(label.name) == -1) {
                                $scope.labels.push(label);
                                _seenLabelNames.push(label.name);
                            }
                        }

                        var assigned = false;
                        for (var assignee of issue.assignees) {
                            if (assignee.login == login) {
                                assigned = true;
                            }
                        }
                        issue['review_requested'] = !assigned;

                        $scope.issues.push(issue);
                    }

                    console.log($scope.issues);

                    $scope.issues.sort(function(a, b) {
                        if (a.repository.name == b.repository.name) {
                            return (a.number - b.number);
                        } else {
                            return (a.repository.name - b.repository.name);
                        }
                    });

                    $scope.labels.sort(function(a, b) {
                        return a.name.localeCompare(b.name);
                    });

                    $scope.repos.sort(function(a, b) {
                        return a.localeCompare(b)
                    });

                }).catch(function(error) {
                    console.log(error);
                });


            };

            function timeout() {
                $timeout(function() {
                    $scope.fetch();
                    timeout();
                }, 60000);
            }
            $scope.fetch();
            timeout();
        }
    ]);
})();
