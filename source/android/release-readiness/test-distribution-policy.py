#!/usr/bin/env python3
"""Exercise the final-component .0 rule across release channels and iOS."""
import importlib.util
import os
from pathlib import Path
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('distribution', HERE / 'verify-distribution.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

class DistributionTests(unittest.TestCase):
    def test_final_zero_is_internal_for_three_or_more_components(self):
        for version in ('3.17.0', '3.17.1.0', '3.17.10.0', '3.17.11.0', '4.2.3.4.0'):
            self.assertEqual(version, policy.verify('internal', version))
            for channel in ('public', 'external'):
                with self.assertRaisesRegex(ValueError, 'INTERNAL TEST ONLY'):
                    policy.verify(channel, version)
    def test_final_ten_and_twenty_are_public_candidates(self):
        for version in ('3.17.1', '3.17.10', '3.17.20', '3.17.100', '4.0.30', '3.17.0.1'):
            for channel in ('internal', 'public', 'external'):
                self.assertEqual(version, policy.verify(channel, version))
    def test_invalid_versions_cannot_bypass_the_guard(self):
        for version in ('3.17.0-beta', '3.17.010', '3.17.0+test', '3.17', '3.17.1.00', '3.17..0'):
            with self.assertRaises(ValueError): policy.verify('public', version)
    def test_cli_validates_an_internal_artifact_even_from_public_source(self):
        result = subprocess.run(['python3',str(HERE/'verify-distribution.py'),'--channel','public','--version','3.17.1.0'],capture_output=True)
        self.assertNotEqual(0,result.returncode)
    def test_ios_internal_identity_and_distribution(self):
        script = HERE.parents[1]/'ios/scripts/check-internal-build.sh'
        for version in ('3.17.0','3.17.1.0','3.17.10.0','3.17.11.0'):
            base = dict(os.environ, MARKETING_VERSION='3.17.1', CW_RELEASE_VERSION=version, CONFIGURATION='Debug', CW_DISTRIBUTION_CHANNEL='internal', PRODUCT_BUNDLE_IDENTIFIER='org.columbiawalks.app.internal')
            self.assertEqual(0,subprocess.run(['sh',str(script)],env=base,capture_output=True).returncode)
            for changes in ({'CONFIGURATION':'Release'},{'CW_DISTRIBUTION_CHANNEL':'external'},{'PRODUCT_BUNDLE_IDENTIFIER':'org.columbiawalks.app'}):
                self.assertNotEqual(0,subprocess.run(['sh',str(script)],env=base|changes,capture_output=True).returncode)
    def test_ios_public_ten_is_not_classified_as_internal(self):
        script = HERE.parents[1]/'ios/scripts/check-internal-build.sh'
        for version in ('3.17.1','3.17.10','3.17.20'):
            env = dict(os.environ,MARKETING_VERSION=version,CONFIGURATION='Release',CW_DISTRIBUTION_CHANNEL='public',PRODUCT_BUNDLE_IDENTIFIER='org.columbiawalks.app')
            env.pop('CW_RELEASE_VERSION',None)
            self.assertEqual(0,subprocess.run(['sh',str(script)],env=env,capture_output=True).returncode)

if __name__ == '__main__': unittest.main()
