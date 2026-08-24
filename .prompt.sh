#!/bin/bash
{

echo "pwd:"

pwd

echo -e "\n"

echo "tree:"
tree
echo -e "\nls -l"
ls -l
echo -e "\n"
pcat -r -x *.pyc *
echo "\n"
echo -e "\n\nSo this is my project, can you basically, basically, I'm going to tell you what you need to do, and you're going to find which files you need to change, and you're going to change them yourself, and you're going to give me the whole file, no collapsed code, nothing. You must always give me the whole file, basically fixed or whatever I wanted, like addition or fixing or whatever, you're going to do that and give me the whole file. You better not collapse anything. You must always give me the whole fixed file or whatever I said, like fix or improve or whatever. You must always do that, and if you don't, that will be very bad. So you better be replying to me the whole file that I need to fix. Only give me the file, and tell me which files I need to fix at the beginning, just so I know prematurely already to mentally remember. So later, I can just, you can just give it to me also, tell me which ones, and tell me how many, and then boom, you can just give me them, and I can just basically copy paste the code. No need, I don't want to be, I don't want you to collapse my code or whatever. This is horrible, never do that. Don't give me collapsed code or whatever, stuff like that, you know what I mean? So yeah, now I'm going to tell you what you need to do and what you need to fix or add or whatever I say, do it. alos use \`\`\`html or \`\`\`js pls."
} | wl-copy
