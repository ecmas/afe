# [JS]AFE
> Js afe is an Nodejs embedded template engine.  
> It runs all template script in vm sandbox,  
> And it support modules like nodejs' module/exports.

## Installation ##
```sh
npm install afe
```
## Template side ##
### echo/html
```
<h1><? echo(title); ?></h1><!--escaped echo-->
<h2><? html('<a>link</a>'); ?></h2><!--raw html data echo-->
```
### Logical control
```
<ul><?
for (var c=0; c<10; c++) {
	?><li><?echo(c);?></li><?
}
?></ul>
```
```
if (condition) {
  ?><a><?
} else {
  ?><b><?
}
```
Note: ?: operator will **not** work, 
like:
```
<? condition ? ?>err<? : ?>err<? ; ?>
```

### include and module
main.afe
```
<head>
<? include('meta', {cs: 'utf-8' }); ?>
</head>
```
meta.afe
```
<meta charset="<? echo($$.cs); ?>" />
```
output:
```html
<head>
<meta charset="utf-8" />
</head>
```
---
page.afe
```
<div><?

var func = include('func');
func.span('Some text.');
  
?></div><?

func.p('test');

//  No end tag needed at end of file, like php.
```
func.afe
```
<?
// This is a function only script,  
// you can include it any where, and call the exported methods.

module.exports.span = function (data) {
  html('<span>');
  echo(data);
  ?></span><?
}

module.exports.p = function (data) {
  ?><p><?
  echo(data);
  ?></p><?
}
```
output:
```html
<div><span>Some text.</span></div><p>test</p>
```
---
### data
```
<?
echo($.title);  //  $ tag to access data from renderFile.
echo($$.count); //  $$ tag for the data from include call.

```

## Nodejs side ##
Only two methods, renderFile/reset.  
renderFile(filename [, data [, options]], callback);  
callback(error, html);  

All afe script are cached, you may need to purge them some time.  
afe.reset();

```javascript
var afe = require('afe');
var data = {
  title: 'Site Title'
};
var options = {
  root: Path.join(__dirname, 'views')
};
afe.renderFile('test.afe', data, options, function (err, html) {
  console.log('afe err:', err);
  console.log('html:', html);
});

// clear cache and vm context.
afe.reset();  
```

#### options
  * `root` Root folder of the script. The parent dir `..` was disabled.
All `include` in the template are relative to root path.
  * `debug` Enable `console` in the template script, and generated code will dump to the terminal.
  * `delimiter` Character to use with angle brackets for open/close, default is `?`, `<? ?>`.
