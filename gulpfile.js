import del from 'del';
import child_process from 'child_process';
import yargs from 'yargs'
import fs from 'fs';
import { hideBin } from 'yargs/helpers'
import AdmZip from 'adm-zip';

/**
 * Cleanup function - delete some files that are not needed and print some messages
 */
function cleanup(cb, language) {
    console.log("Deleting some files...");
    del(['dist/base/index.html']);

    console.log("Finished!");
    if (language == "full-offline") {
        console.log("If you want to set up a single-file distributable web server, use dist/base/redbean.com and check the icp-create-server repository");
    }
    console.log(`If you want to use the library and deploy to a server, all you need is the generated dist/base/${language}.iife.js\n`);
    cb();
}

/**
 * Main task - build the project for the specified language
 */
export default (cb) => {
    // Check the language argument
    const args = yargs(hideBin(process.argv)).argv;
    if (args["language"] == undefined) {
        // If the language argument is not specified, print the help message
        console.log("Please specify a language to build the project for. For example, to build the project for python, use the following command:");
        console.log("\tnpm run build -- --language python\n");
        console.log("To build the project for all languages, use the following command:");
        console.log("\tnpm run build -- --language full\n");
        console.log("If you want to run python or java in offline mode, use the following command:");
        console.log("\tnpm run build -- --language ${language}-offline\n");
        console.log("The other languages instead already work in offline mode even when built normally.\n");
        process.exit(1);
    }
    const language = args["language"] == "p5" || args["language"] == "processing" ? "p5-and-processing" : args["language"];

    var incremental;

    if (args["incremental"] == undefined) {
        incremental = false;
    } else {
        console.log("Please specify if languages should be built incrementally using:");
        incremental = true;
    }

    if (!incremental) {
        if (fs.existsSync("./dist")) {
            child_process.exec(`rm -r ./dist`, (err, stdout, stderr) => {
                if (err) {
                    console.log("[ERROR] deleting /dist dir");
                    cb(err);
                }
            });
        }
    }

    var mobile;

    if (args["mobile"] == undefined) {
        mobile = false;
    } else {
        mobile = true;
    }

    console.log(`Building the project for '${language}' - this may take a while...`);
    
    child_process.exec(`vite build -c=build-config/vite.${language}.js`, (err, stdout, stderr) => {
        if (err) {
            console.log("[ERROR] building the project");
            cb(err);
        }

        // Replace "use strict"; with "use strict";\nglobalThis.process = globalThis.process;\n
        // This is because the p5-and-processing library uses process, which is undefined in the browser
        // This is a hacky way to fix it
        console.log("Replacing process with globalThis.process");
        child_process.exec(`sed -i 's/\"use strict\";/\"use strict\";\\nglobalThis.process = globalThis.process;\\n/g' dist/base/${language}.iife.js`, (err, stdout, stderr) => {
            if (err) {
                console.log("[ERROR] replacing process with globalThis.process");
                cb(err);
            }
        });

        console.log("Build completed!");

        if (language == "javascript" || language == "typescript" || language == "sql" || language == "p5" || language == "processing" || language == "standard-ml" || language == "cpp" || language == "java" || language == "python") {
            if (mobile) {
                try {
                    fs.stat("./dist/base/export_languages.zip", function(err, stat) {
                        if (err == null) {
                            var zip = new AdmZip("./dist/base/export_languages.zip");

                            zip.extractAllTo("./dist/base/tmp", true);
                            fs.copyFile("./dist/base/" + language + ".iife.js", "./dist/base/tmp/" + language + ".iife.js", (err) => {
                                if (err) throw err;
                            });

                            zip.addLocalFolder("./dist/base/tmp");
                            zip.writeZip("./dist/base/export_languages.zip");
                            fs.rmSync("./dist/base/tmp", { recursive: true, force: true });

                        } else if (err.code === 'ENOENT') {
                            // file does not exist
                            var zip = new AdmZip();
                            zip.addLocalFile("./dist/base/" + language + ".iife.js");
                            zip.writeZip("./dist/base/export_languages.zip");
                        } else {
                            console.log('Some other error: ', err.code);
                        }
                    });

                    console.log("Zip file export_languages.zip created!")
                } catch (e) {
                    console.log(`Error creating zip file. ${e}`);
                }
            }
        } else if (language == "cpp-offline" || language == "java-offline" || language == "python-offline") {
            if (mobile) {
                var short_name;
                if (language == "cpp-offline") {
                    short_name = "cpp";
                } else if (language == "java-offline") {
                    short_name = "java";
                } else {
                    short_name = "python";
                };

                try {
                    fs.stat("./dist/base/export_languages.zip", function(err, stat) {
                        if (err == null) {
                            var zip = new AdmZip("./dist/base/export_languages.zip");

                            zip.extractAllTo("./dist/base/tmp", true);
                            fs.copyFile("./dist/base/" + language + ".iife.js", "./dist/base/tmp/" + language + ".iife.js", (err) => {
                                if (err) throw err;
                            });

                            child_process.exec("cp ./dist/base/utils/" + short_name + " ./dist/base/tmp/utils -r", (err, stdout, stderr) => {
                                if (err) {
                                    console.log("[ERROR] creating zip file");
                                    cb(err);
                                } else {
                                    zip.addLocalFolder("./dist/base/tmp");
                                    zip.addLocalFolder("./dist/base/utils/" + short_name, "/utils/" + short_name);
                                    zip.writeZip("./dist/base/export_languages.zip");
                                    fs.rmSync("./dist/base/tmp", { recursive: true, force: true });
                                }
                            });
                        } else if (err.code === 'ENOENT') {
                            // file does not exist
                            var zip = new AdmZip();
                            zip.addLocalFile("./dist/base/" + language + ".iife.js");
                            zip.addLocalFolder("./dist/base/utils/" + short_name, "/utils/" + short_name);
                            zip.writeZip("./dist/base/export_languages.zip");
                        } else {
                            console.log('Some other error: ', err.code);
                        }
                    });

                    console.log("Zip file export_languages.zip created!")
                } catch (e) {
                    console.log(`Error creating zip file. ${e}`);
                }
            }
        } else if (language == "full-offline" || language == "full") {
            if (mobile) {
                try {
                    var zip = new AdmZip();
                    zip.addLocalFile("./dist/base/" + language + ".iife.js");

                    if (language == "full-offline") {
                        zip.addLocalFolder("./dist/base/utils", "/utils");
                    }

                    zip.writeZip("./dist/base/export_languages.zip");
                    console.log("Zip file export_languages.zip created!")
                } catch (e) {
                    console.log(`Error creating zip file. ${e}`);
                }
            }
            console.log("Setting up redbean.com for full offline mode.")
            child_process.exec("bash build.sh", (err, stdout, stderr) => {
                if (err) {
                    console.log("[ERROR]", err);
                } else {
                    console.log("Completed!")
                }
            })
        } else {
            cleanup(cb, language);
        }
    });
}


// Create a custom task 'prepare-cpp'
export function prepareCpp(cb) {
    console.log("Preparing C++ files...");
    child_process.exec("vite build -c=build-config/vite.prepare-cpp.js", (err, stdout, stderr) => {
        if (err) {
            console.log("[ERROR] preparing C++ files");
            cb(err);
        }
        // Get the list of files and directories in the public folder
        const files = fs.readdirSync("public");
        // Remove all these files from src/modules/workers/cpp
        files.forEach(file => {
            console.log(`Removing ${file} from src/modules/workers/cpp`);
            del([`src/modules/workers/cpp/${file}`]);
        });
        child_process.exec("cp src/modules/workers/cpp/cppWorkerBundle.iife.js public/utils/cpp/cppWorkerBundle.iife.js", (err, stdout, stderr) => {
            if (err) {
                console.log("[ERROR] copying worker to public folder");
                cb(err);
            }
            console.log("Finished preparing C++ files!");
            cb();
        });
    });
}

// Create a custom task 'prepare-python'
export function preparePython(cb) {
    console.log("Preparing Python files...");
    child_process.exec("vite build -c=build-config/vite.prepare-python.js", (err, stdout, stderr) => {
        if (err) {
            console.log("[ERROR] preparing Python files");
            cb(err);
        }
        // Get the list of files and directories in the public folder
        const files = fs.readdirSync("public");
        // Remove all these files from src/modules/workers
        files.forEach(file => {
            console.log(`Removing ${file} from src/modules/workers`);
            del([`src/modules/workers/${file}`]);
        });
        child_process.exec("cp src/modules/workers/pythonWorkerBundle.iife.js public/utils/python/pyodide/pythonWorkerBundle.iife.js", (err, stdout, stderr) => {
            if (err) {
                console.log("[ERROR] copying worker to public folder");
                cb(err);
            }
            console.log("Finished preparing Python files!");
            cb();
        });
    });
}

// Create a custom task 'prepare-java'
export function prepareJava(cb) {
    console.log("Preparing Java files...");
    child_process.exec("cp src/modules/workers/java/javaWorker.js public/utils/java/javaWorker.js", (err, stdout, stderr) => {
        if (err) {
            console.log("[ERROR] moving javaWorker.js to javaWorker.js");
            cb(err);
        }
        child_process.exec("cp src/modules/workers/java/javaTeaWorkerOffline.js public/utils/java/javaTeaWorker.js", (err, stdout, stderr) => {
            if (err) {
                console.log("[ERROR] moving javaTeaWorkerOffline.js to javaTeaWorker.js");
                cb(err);
            }
            child_process.exec("cp src/modules/workers/java/javaRunWorker.js public/utils/java/javaRunWorker.js", (err, stdout, stderr) => {
                if (err) {
                    console.log("[ERROR] moving javaRunWorker.js to javaRunWorker.js");
                    cb(err);
                }
                console.log("Finished preparing Java files!");
                cb();
            });
        });
    });
}

