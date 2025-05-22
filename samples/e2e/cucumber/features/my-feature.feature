Feature: Example feature
  As a user of WebdriverIO
  I should be able to use different commands
  to get information about elements on the page

  Scenario: Get title of website
    Given I go on the website "https://webdriver.io"
    Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"

  Rule: Business rule 1
    Scenario: Get title of website
      Given I go on the website "https://github.com/"
      Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"

  Rule: Business rule 2
    Scenario: Data Tables
      Given I go on the website "http://todomvc.com/examples/react/dist/"
      When I add the following groceries
          | Item       | Amount |
          | Milk       | 2      |
          | Butter     | 1      |
          | Noodles    | 1      |
          | Chocolate  | 3      |
      Then I should have a list of 4 items
